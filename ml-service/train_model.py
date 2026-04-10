"""
AI Resume Analyzer — ML Training Pipeline
==========================================
Trains a Random Forest classifier on resume data to improve
relevance scoring beyond basic TF-IDF cosine similarity.

HOW TO RUN:
    pip install -r requirements_train.txt
    python train_model.py --dataset path/to/resumes.csv

DATASET FORMAT (CSV):
    resume_text  | job_description | label
    "John has..."| "We need..."    | 1      (1=relevant, 0=not relevant)
    ...

If you don't have a labeled dataset, use --synthetic to generate
one for testing. For production, use the UpdatedHuggingFace Resume
Dataset or Kaggle "Resume Dataset" (25k+ entries).

WHAT THIS TRAINS:
    1. TF-IDF vectorizer (saved as tfidf_vectorizer.pkl)
    2. Random Forest classifier (saved as rf_classifier.pkl)
    3. Label encoder (saved as label_encoder.pkl)

HOW IT INTEGRATES WITH app.py:
    The trained models are loaded on startup in app.py and used
    alongside (not instead of) cosine similarity scoring.
    RF adds a relevance_confidence score to the API response.
"""

import argparse
import os
import re
import json
import pickle
import numpy as np
from pathlib import Path

# ── Dependencies ─────────────────────────────────────────────────
try:
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
    from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
    from sklearn.preprocessing import LabelEncoder
    from sklearn.pipeline import Pipeline
    from sklearn.utils import shuffle
    import spacy
    HAS_SPACY = True
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install -r requirements_train.txt")
    exit(1)

# ── Config ───────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

TFIDF_PATH = MODEL_DIR / "tfidf_vectorizer.pkl"
RF_PATH    = MODEL_DIR / "rf_classifier.pkl"
META_PATH  = MODEL_DIR / "model_meta.json"

# Common tech skill synonyms — used in preprocessing
# This teaches the model that "ML" ≈ "Machine Learning", etc.
SKILL_SYNONYMS = {
    r"\bml\b":              "machine learning",
    r"\bnlp\b":             "natural language processing",
    r"\bai\b":              "artificial intelligence",
    r"\bdl\b":              "deep learning",
    r"\boop\b":             "object oriented programming",
    r"\bjs\b":              "javascript",
    r"\bts\b":              "typescript",
    r"\bpy\b":              "python",
    r"\bdb\b":              "database",
    r"\bapi\b":             "application programming interface",
    r"\bci/cd\b":           "continuous integration continuous deployment",
    r"\baws\b":             "amazon web services",
    r"\bgcp\b":             "google cloud platform",
    r"\bk8s\b":             "kubernetes",
    r"\bsql\b":             "structured query language",
    r"\bnosql\b":           "not only sql",
    r"\brest\b":            "representational state transfer",
    r"\bbackend\b":         "back end server side",
    r"\bfrontend\b":        "front end client side",
    r"\bfullstack\b":       "full stack",
    r"\bjava dev\b":        "java developer backend developer",
    r"\bpython dev\b":      "python developer backend developer",
}

# ═══════════════════════════════════════════════════════════════
#  TEXT PREPROCESSING
# ═══════════════════════════════════════════════════════════════

def preprocess_text(text: str) -> str:
    """
    Clean and normalize resume/JD text.

    Steps:
    1. Lowercase
    2. Expand skill abbreviations (ML → machine learning)
    3. Remove special characters but keep alphanumerics
    4. Remove extra whitespace
    5. (Optional) Lemmatize with spaCy if available

    This is the SAME function used in app.py at inference time,
    so training and prediction are consistent.
    """
    if not text or not isinstance(text, str):
        return ""

    text = text.lower().strip()

    # Expand known abbreviations
    for pattern, replacement in SKILL_SYNONYMS.items():
        text = re.sub(pattern, replacement, text)

    # Remove URLs, emails
    text = re.sub(r'http\S+|www\S+|@\S+', ' ', text)

    # Keep letters, numbers, and spaces
    text = re.sub(r'[^a-z0-9\s]', ' ', text)

    # Collapse multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def preprocess_batch(texts: list, use_spacy: bool = False) -> list:
    """Process a list of texts. Optionally use spaCy for lemmatization."""
    if use_spacy and HAS_SPACY:
        try:
            nlp = spacy.load("en_core_web_sm", disable=["ner", "parser"])
            processed = []
            for doc in nlp.pipe(texts, batch_size=64):
                lemmas = [token.lemma_ for token in doc
                          if not token.is_stop and not token.is_punct and len(token.text) > 2]
                processed.append(" ".join(lemmas))
            return processed
        except OSError:
            print("⚠️  spaCy model not found, using basic preprocessing")

    return [preprocess_text(t) for t in texts]


# ═══════════════════════════════════════════════════════════════
#  FEATURE ENGINEERING
#  Combines resume + JD into a single feature vector.
#  Three strategies:
#    "concat"   — simple concatenation (fast, good baseline)
#    "diff"     — also adds difference vector (better for gap analysis)
#    "pairwise" — all three: resume, jd, diff (best accuracy)
# ═══════════════════════════════════════════════════════════════

def build_features(resume_texts: list,
                   jd_texts: list,
                   vectorizer: TfidfVectorizer = None,
                   strategy: str = "pairwise",
                   fit: bool = False):
    """
    Build feature matrix from resume + JD pairs.

    Returns: (feature_matrix, vectorizer)
    """
    # Preprocess
    resumes_clean = preprocess_batch(resume_texts, use_spacy=False)
    jds_clean     = preprocess_batch(jd_texts, use_spacy=False)

    if vectorizer is None:
        vectorizer = TfidfVectorizer(
            max_features=5000,          # vocabulary size
            ngram_range=(1, 2),         # unigrams + bigrams
            min_df=2,                   # ignore very rare terms
            max_df=0.95,                # ignore very common terms
            sublinear_tf=True,          # log-scale TF
            strip_accents='unicode',
            analyzer='word',
        )

    if fit:
        # Fit on ALL text (both resumes and JDs) for richer vocabulary
        all_texts = resumes_clean + jds_clean
        vectorizer.fit(all_texts)

    resume_vecs = vectorizer.transform(resumes_clean).toarray()
    jd_vecs     = vectorizer.transform(jds_clean).toarray()

    if strategy == "concat":
        # Simple concatenation: [resume | jd]
        features = np.hstack([resume_vecs, jd_vecs])

    elif strategy == "diff":
        # [resume | jd | diff]
        diff = resume_vecs - jd_vecs
        features = np.hstack([resume_vecs, jd_vecs, diff])

    elif strategy == "pairwise":
        # [resume | jd | diff | element-wise product]
        # The product captures which features are shared (intersection)
        diff    = resume_vecs - jd_vecs
        product = resume_vecs * jd_vecs
        features = np.hstack([resume_vecs, jd_vecs, diff, product])

    else:
        features = np.hstack([resume_vecs, jd_vecs])

    return features, vectorizer


# ═══════════════════════════════════════════════════════════════
#  SYNTHETIC DATASET GENERATOR
#  Creates a labeled dataset for testing when no real data exists.
#  DO NOT use in production — replace with real labeled data.
# ═══════════════════════════════════════════════════════════════

def generate_synthetic_dataset(n_samples: int = 2000) -> pd.DataFrame:
    """
    Generate a synthetic labeled resume dataset for smoke-testing
    the training pipeline.

    In production, replace this with:
    - Kaggle: "Resume Dataset" (~2500 labeled resumes)
    - UpdatedResumeDataSet.csv (25k+ resumes from GitHub)
    - Your own labeled data exported from the application
    """
    print(f"⚠️  Generating {n_samples} synthetic training samples...")
    print("   For production use, replace with a real labeled dataset.")

    np.random.seed(42)

    tech_skills = [
        "python java spring boot react angular docker kubernetes aws azure",
        "machine learning deep learning tensorflow pytorch scikit-learn numpy pandas",
        "sql mysql postgresql mongodb redis elasticsearch nosql database",
        "javascript typescript node express react vue frontend backend",
        "data analysis visualization tableau powerbi excel statistics",
        "devops ci cd jenkins github actions terraform ansible linux",
        "nlp natural language processing spacy bert transformers",
        "cloud computing microservices rest api graphql agile scrum",
    ]

    jd_templates = [
        "Looking for a {role} with experience in {skills}. Must have {years} years.",
        "Senior {role} needed. Strong skills in {skills}. Team player.",
        "We need a {role} who knows {skills}. Remote friendly position.",
        "{role} position available. Required: {skills}. Nice to have: {extra}.",
    ]

    roles = ["Software Engineer", "Data Scientist", "Backend Developer",
             "Full Stack Developer", "ML Engineer", "DevOps Engineer",
             "Python Developer", "Java Developer", "Frontend Developer"]

    records = []
    for i in range(n_samples):
        role = np.random.choice(roles)
        core_skills = np.random.choice(tech_skills)
        extra_skills = np.random.choice(tech_skills)
        years = np.random.randint(1, 8)

        jd = f"Looking for a {role} with {years}+ years. Skills required: {core_skills}."

        # Positive sample (relevant resume)
        if np.random.random() > 0.35:
            overlap = int(len(core_skills.split()) * np.random.uniform(0.5, 1.0))
            resume_words = core_skills.split()[:overlap] + extra_skills.split()[:3]
            resume = f"Experienced {role} with {years} years. Skills: {' '.join(resume_words)}. " \
                     f"Worked on multiple projects involving {np.random.choice(tech_skills[:4])}."
            label = 1
        # Negative sample (irrelevant resume)
        else:
            unrelated = np.random.choice([s for s in tech_skills if s != core_skills])
            resume = f"Professional with experience in {unrelated}. " \
                     f"Looking for opportunities in {np.random.choice(roles)}."
            label = 0

        records.append({
            'resume_text': resume,
            'job_description': jd,
            'label': label,
        })

    df = pd.DataFrame(records)
    print(f"   ✅ Generated {len(df)} samples. Label distribution:")
    print(f"      Relevant:   {df['label'].sum()} ({df['label'].mean()*100:.1f}%)")
    print(f"      Irrelevant: {(~df['label'].astype(bool)).sum()} ({(1-df['label'].mean())*100:.1f}%)")
    return df


# ═══════════════════════════════════════════════════════════════
#  TRAINING
# ═══════════════════════════════════════════════════════════════

def train(df: pd.DataFrame, feature_strategy: str = "pairwise") -> dict:
    """
    Train the Random Forest classifier.

    Returns: dict with accuracy, report, and feature importance.
    """
    print("\n" + "="*55)
    print("🚀 Training Random Forest Resume Classifier")
    print("="*55)
    print(f"   Dataset size:    {len(df)} samples")
    print(f"   Feature strategy: {feature_strategy}")

    # ── 1. Prepare data ───────────────────────────────────────
    df = shuffle(df, random_state=42).reset_index(drop=True)

    resume_texts = df['resume_text'].fillna('').tolist()
    jd_texts     = df['job_description'].fillna('').tolist()
    labels       = df['label'].values

    # ── 2. Split ──────────────────────────────────────────────
    (r_train, r_test,
     j_train, j_test,
     y_train, y_test) = train_test_split(
        resume_texts, jd_texts, labels,
        test_size=0.2, random_state=42, stratify=labels
    )

    print(f"   Train: {len(r_train)} | Test: {len(r_test)}")

    # ── 3. Build features ─────────────────────────────────────
    print("\n📐 Building TF-IDF features...")
    X_train, vectorizer = build_features(r_train, j_train, strategy=feature_strategy, fit=True)
    X_test,  _          = build_features(r_test,  j_test,  vectorizer=vectorizer, strategy=feature_strategy)

    print(f"   Feature dimensions: {X_train.shape[1]}")

    # ── 4. Train Random Forest ────────────────────────────────
    print("\n🌲 Training Random Forest classifier...")
    rf = RandomForestClassifier(
        n_estimators=200,       # 200 trees — good balance of accuracy vs speed
        max_depth=20,           # prevent overfitting
        min_samples_split=5,
        min_samples_leaf=2,
        max_features='sqrt',    # standard for RF
        class_weight='balanced',# handle class imbalance
        n_jobs=-1,              # use all CPU cores
        random_state=42,
        verbose=0,
    )
    rf.fit(X_train, y_train)

    # ── 5. Evaluate ───────────────────────────────────────────
    y_pred = rf.predict(X_test)
    y_prob = rf.predict_proba(X_test)[:, 1]  # probability of relevance

    accuracy = accuracy_score(y_test, y_pred)
    report   = classification_report(y_test, y_pred, target_names=['Irrelevant', 'Relevant'])

    # Cross-validation for more robust accuracy estimate
    print("\n📊 Running 5-fold cross-validation...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, X_train, y_train, cv=cv, scoring='accuracy', n_jobs=-1)

    print(f"\n{'='*55}")
    print(f"✅ Test Accuracy:  {accuracy * 100:.2f}%")
    print(f"✅ CV Accuracy:    {cv_scores.mean() * 100:.2f}% ± {cv_scores.std() * 100:.2f}%")
    print(f"\n{report}")

    # ── 6. Feature importance (top 20) ───────────────────────
    vocab = vectorizer.get_feature_names_out()
    # Feature matrix is 4x vocab size (resume, jd, diff, product)
    # Only show importance from the resume slice
    importances = rf.feature_importances_
    vocab_size  = len(vocab)
    resume_importances = importances[:vocab_size]
    top_idx = resume_importances.argsort()[-20:][::-1]
    top_features = [(vocab[i], float(resume_importances[i])) for i in top_idx]

    print("🔑 Top 20 most important features:")
    for feat, imp in top_features[:10]:
        print(f"   {feat:<30} {imp:.4f}")

    # ── 7. Save models ────────────────────────────────────────
    print(f"\n💾 Saving models to {MODEL_DIR}/")

    with open(TFIDF_PATH, 'wb') as f:
        pickle.dump(vectorizer, f)

    with open(RF_PATH, 'wb') as f:
        pickle.dump(rf, f)

    meta = {
        "test_accuracy":    round(accuracy * 100, 2),
        "cv_accuracy_mean": round(cv_scores.mean() * 100, 2),
        "cv_accuracy_std":  round(cv_scores.std() * 100, 2),
        "n_samples":        len(df),
        "n_features":       X_train.shape[1],
        "feature_strategy": feature_strategy,
        "n_estimators":     rf.n_estimators,
        "top_features":     top_features[:20],
        "vocab_size":       int(vocab_size),
    }

    with open(META_PATH, 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"   ✅ tfidf_vectorizer.pkl  ({TFIDF_PATH.stat().st_size // 1024} KB)")
    print(f"   ✅ rf_classifier.pkl     ({RF_PATH.stat().st_size // 1024} KB)")
    print(f"   ✅ model_meta.json")
    print("\n🎉 Training complete! Models ready for app.py integration.\n")

    return meta


# ═══════════════════════════════════════════════════════════════
#  INFERENCE HELPERS (used by app.py)
# ═══════════════════════════════════════════════════════════════

def load_models():
    """Load trained models from disk. Returns (vectorizer, rf) or (None, None)."""
    if not TFIDF_PATH.exists() or not RF_PATH.exists():
        return None, None
    try:
        with open(TFIDF_PATH, 'rb') as f:
            vectorizer = pickle.load(f)
        with open(RF_PATH, 'rb') as f:
            rf = pickle.load(f)
        return vectorizer, rf
    except Exception as e:
        print(f"⚠️  Failed to load models: {e}")
        return None, None


def predict_relevance(resume_text: str, jd_text: str,
                      vectorizer, rf,
                      strategy: str = "pairwise") -> dict:
    """
    Predict resume relevance using the trained Random Forest.

    Returns:
        {
          "rf_relevant": bool,          True if RF classifies as relevant
          "rf_confidence": float,       0.0–1.0 confidence score
          "rf_score_boost": float,      score boost to add to cosine score
        }
    """
    try:
        features, _ = build_features(
            [resume_text], [jd_text],
            vectorizer=vectorizer,
            strategy=strategy,
            fit=False
        )

        prediction = rf.predict(features)[0]
        probabilities = rf.predict_proba(features)[0]
        confidence = float(probabilities[1])  # P(relevant)

        # Calculate a score boost: RF confidence adds up to +15 points
        # to the cosine similarity score
        boost = confidence * 15.0 if prediction == 1 else -(1 - confidence) * 5.0

        return {
            "rf_relevant":    bool(prediction == 1),
            "rf_confidence":  round(confidence, 3),
            "rf_score_boost": round(boost, 2),
        }
    except Exception as e:
        print(f"RF prediction error: {e}")
        return {"rf_relevant": True, "rf_confidence": 0.5, "rf_score_boost": 0.0}


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the Resume Analyzer ML model")
    parser.add_argument('--dataset',   type=str,  default=None,
                        help="Path to CSV with columns: resume_text, job_description, label")
    parser.add_argument('--synthetic', action='store_true',
                        help="Generate a synthetic dataset for testing")
    parser.add_argument('--samples',   type=int,  default=2000,
                        help="Number of synthetic samples (default: 2000)")
    parser.add_argument('--strategy',  type=str,  default='pairwise',
                        choices=['concat', 'diff', 'pairwise'],
                        help="Feature engineering strategy (default: pairwise)")
    args = parser.parse_args()

    # Load or generate dataset
    if args.dataset:
        print(f"📂 Loading dataset from {args.dataset}...")
        df = pd.read_csv(args.dataset)
        required_cols = {'resume_text', 'job_description', 'label'}
        if not required_cols.issubset(df.columns):
            print(f"❌ Dataset must have columns: {required_cols}")
            print(f"   Found: {set(df.columns)}")
            exit(1)
        print(f"   Loaded {len(df)} rows")
    elif args.synthetic:
        df = generate_synthetic_dataset(args.samples)
    else:
        print("ℹ️  No dataset provided. Using synthetic data for demonstration.")
        print("   Use --dataset path/to/data.csv for real training.")
        print("   Use --synthetic to explicitly use synthetic data.\n")
        df = generate_synthetic_dataset(1000)

    # Train
    meta = train(df, feature_strategy=args.strategy)

    print("\n📋 Model Summary:")
    print(f"   Test accuracy:  {meta['test_accuracy']}%")
    print(f"   CV accuracy:    {meta['cv_accuracy_mean']}% ± {meta['cv_accuracy_std']}%")
    print(f"   Vocabulary:     {meta['vocab_size']} terms")
    print(f"   Features:       {meta['n_features']} dimensions")
    print(f"\n   To use in app.py, restart the Flask service.")
    print(f"   The models will be auto-loaded from: {MODEL_DIR}")
