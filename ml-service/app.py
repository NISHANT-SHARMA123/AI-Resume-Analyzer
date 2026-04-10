"""
AI Resume Analyzer — Python ML Microservice (Updated)
======================================================
CHANGES FROM ORIGINAL:
  - Loads trained Random Forest model on startup (if available)
  - RF prediction runs alongside TF-IDF cosine similarity
  - RF confidence score is used to boost/adjust the final match score
  - Returns rf_confidence and rf_relevant in API response
  - New /train-status endpoint to check model state
  - Preprocessing now expands skill abbreviations (ML→machine learning, etc.)

TECHNIQUES:
  - spaCy          → NER to extract skills and entities
  - TF-IDF         → Text vectorization
  - Cosine Similarity → Base match score
  - Random Forest  → Relevance classification + score boost
  - OpenAI GPT     → Human feedback and suggestions (optional)

HOW TO RUN:
  pip install -r requirements.txt
  python -m spacy download en_core_web_sm
  python app.py

TO TRAIN THE MODEL FIRST:
  python train_model.py --synthetic --samples 2000
  (or: python train_model.py --dataset your_data.csv)
"""

import os
import re
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import spacy

# ── Load optional dependencies ────────────────────────────────
try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    USE_OPENAI = bool(os.getenv("OPENAI_API_KEY"))
except ImportError:
    USE_OPENAI = False

# ── FEATURE 1: Sentence-Transformers (semantic embeddings) ────
# Falls back gracefully if not installed:
#   pip install sentence-transformers
try:
    from sentence_transformers import SentenceTransformer, util as st_util
    _SBERT_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    SBERT_LOADED = True
    print("✅ sentence-transformers loaded (all-MiniLM-L6-v2)")
except Exception:
    SBERT_LOADED = False
    _SBERT_MODEL = None
    print("ℹ️  sentence-transformers not available — using TF-IDF fallback")
    print("   To enable: pip install sentence-transformers")

try:
    nlp = spacy.load("en_core_web_sm")
    SPACY_LOADED = True
except OSError:
    print("⚠️  spaCy model not found. Run: python -m spacy download en_core_web_sm")
    SPACY_LOADED = False

# ── Load trained Random Forest model (if available) ──────────
try:
    from train_model import load_models, predict_relevance, preprocess_text
    RF_VECTORIZER, RF_MODEL = load_models()
    RF_LOADED = RF_VECTORIZER is not None and RF_MODEL is not None
    if RF_LOADED:
        print("✅ Random Forest model loaded from models/")
    else:
        print("ℹ️  No trained RF model found. Run: python train_model.py --synthetic")
        print("   Falling back to TF-IDF cosine similarity only.")
except ImportError:
    RF_LOADED = False
    print("ℹ️  train_model.py not found. RF scoring disabled.")

    def preprocess_text(text):
        """Fallback preprocessing without train_model module."""
        if not text:
            return ""
        synonyms = {
            r"\bml\b": "machine learning",
            r"\bnlp\b": "natural language processing",
            r"\bai\b": "artificial intelligence",
            r"\bjs\b": "javascript",
            r"\bts\b": "typescript",
        }
        text = text.lower()
        for pattern, replacement in synonyms.items():
            text = re.sub(pattern, replacement, text)
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        return re.sub(r'\s+', ' ', text).strip()

app = Flask(__name__)
CORS(app)


# ── Tech Skills Dictionary ────────────────────────────────────
TECH_SKILLS = {
    "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go", "rust",
    "php", "swift", "kotlin", "scala", "r", "matlab",
    "spring", "spring boot", "react", "angular", "vue", "django", "flask",
    "node.js", "express", "fastapi", "hibernate", "junit",
    "mysql", "postgresql", "mongodb", "redis", "oracle", "sqlite", "cassandra",
    "elasticsearch", "dynamodb", "firebase",
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "terraform",
    "ci/cd", "github actions", "ansible",
    "git", "github", "linux", "rest", "graphql", "microservices", "agile",
    "scrum", "jira", "machine learning", "deep learning", "tensorflow",
    "pytorch", "scikit-learn", "pandas", "numpy", "spark", "natural language processing",
    "artificial intelligence", "random forest", "nlp", "computer vision",
}



# ═══════════════════════════════════════════════════════════════
#  MULTI-DIMENSIONAL SCORING ENGINE
#  Four sub-scores returned alongside the existing matchScore.
#  matchScore (TF-IDF + RF) is preserved unchanged.
#
#  skillScore        — how many JD-required skills appear in resume
#  experienceScore   — evidence of relevant work history
#  projectScore      — presence and quality of project work
#  resumeQualityScore — ATS-friendliness and resume structure
# ═══════════════════════════════════════════════════════════════

def calculate_skill_score(matched: set, jd_keywords: set) -> float:
    """
    Ratio of JD-required skills found in the resume.
    matched  = resume_keywords ∩ jd_keywords (already computed in analyze())
    Returns 0-100.
    """
    total_jd = len(jd_keywords)
    if total_jd == 0:
        return 50.0
    raw = (len(matched) / total_jd) * 100
    return round(min(100.0, raw), 1)


def calculate_experience_score(resume_text: str, job_description: str) -> float:
    """
    Heuristic score for work-experience relevance.
    Checks: experience section presence, date patterns (real work history),
    experience-level alignment, role-title overlap.
    Returns 0-100.
    """
    resume_lower    = resume_text.lower()
    jd_lower        = job_description.lower()
    score           = 30.0   # base — everyone starts at 30

    # ── Section presence ────────────────────────────────────
    exp_section_markers = [
        'experience', 'work history', 'employment', 'career',
        'worked at', 'working at', 'professional background',
    ]
    if any(m in resume_lower for m in exp_section_markers):
        score += 20.0

    # ── Date patterns → evidence of real history ────────────
    year_patterns = re.findall(r'\b(20\d{2}|19\d{2})\b', resume_text)
    if len(year_patterns) >= 4:
        score += 20.0
    elif len(year_patterns) >= 2:
        score += 12.0
    elif len(year_patterns) >= 1:
        score += 6.0

    # ── JD experience level vs resume signals ───────────────
    jd_wants_senior = any(k in jd_lower for k in [
        'senior', '5+ years', '5 years', '7 years', 'lead ', 'principal', 'staff',
    ])
    jd_wants_mid = any(k in jd_lower for k in [
        '3 years', '4 years', '3-5 years', 'mid-level', 'mid level',
    ])
    jd_wants_junior = any(k in jd_lower for k in [
        'junior', 'entry level', 'entry-level', '0-2 years', '1 year', '2 years',
        'fresher', 'graduate', 'intern',
    ])

    if jd_wants_senior and len(year_patterns) >= 4:
        score += 15.0
    elif jd_wants_mid and len(year_patterns) >= 2:
        score += 12.0
    elif jd_wants_junior and any(k in resume_lower for k in [
        'intern', 'project', 'fresher', 'graduate',
    ]):
        score += 15.0

    # ── Role title overlap ──────────────────────────────────
    common_titles = [
        'developer', 'engineer', 'analyst', 'manager', 'architect',
        'designer', 'consultant', 'specialist', 'scientist', 'lead',
    ]
    for title in common_titles:
        if title in jd_lower and title in resume_lower:
            score += 5.0
            break   # only one bonus

    return round(min(100.0, score), 1)


def calculate_project_score(resume_text: str, job_description: str) -> float:
    """
    Heuristic score for project relevance and depth.
    Checks: projects section, action verbs, impact language,
    tech-stack overlap, open-source / internship contributions.
    Returns 0-100.
    """
    resume_lower = resume_text.lower()
    jd_lower     = job_description.lower()
    score        = 20.0   # base

    # ── Project section markers + action verbs ──────────────
    project_verbs = [
        'project', 'built', 'developed', 'created', 'implemented',
        'designed', 'deployed', 'architected', 'engineered', 'launched',
    ]
    verb_hits = sum(1 for v in project_verbs if v in resume_lower)
    if verb_hits >= 5:
        score += 25.0
    elif verb_hits >= 3:
        score += 18.0
    elif verb_hits >= 1:
        score += 10.0

    # ── Impact / measurable language ────────────────────────
    impact_signals = [
        'improved', 'increased', 'reduced', 'optimized', 'automated',
        'delivered', 'scaled', 'saved', 'performance', 'users', 'revenue',
    ]
    has_metric   = bool(re.search(r'\d+\s*%|\d{3,}\s*users|\$\d', resume_text))
    impact_hits  = sum(1 for w in impact_signals if w in resume_lower)

    if has_metric:
        score += 15.0
    if impact_hits >= 4:
        score += 15.0
    elif impact_hits >= 2:
        score += 8.0

    # ── Tech-stack overlap ───────────────────────────────────
    jd_tech     = {s for s in TECH_SKILLS if s in jd_lower}
    resume_tech = {s for s in TECH_SKILLS if s in resume_lower}
    overlap     = len(jd_tech & resume_tech)
    if overlap >= 6:
        score += 15.0
    elif overlap >= 3:
        score += 10.0
    elif overlap >= 1:
        score += 5.0

    # ── Open-source / internship / GitHub bonus ─────────────
    if any(k in resume_lower for k in [
        'internship', 'intern', 'github', 'open source',
        'open-source', 'contribution', 'hackathon',
    ]):
        score += 10.0

    return round(min(100.0, score), 1)


def calculate_resume_quality_score(resume_text: str) -> float:
    """
    ATS-friendliness and structural quality of the resume.
    Checks: key sections present, length, action verbs,
    measurable achievements; penalises keyword stuffing.
    Returns 0-100.
    """
    resume_lower = resume_text.lower()
    word_count   = len(resume_text.split())
    score        = 10.0   # base

    # ── Key section checklist ────────────────────────────────
    section_map = {
        'contact':    ['email', 'phone', 'linkedin', '@'],
        'summary':    ['summary', 'objective', 'profile', 'about'],
        'experience': ['experience', 'employment', 'work history'],
        'education':  ['education', 'degree', 'university', 'college', 'bachelor', 'master'],
        'skills':     ['skills', 'technologies', 'technical skills', 'tools'],
        'projects':   ['project', 'built', 'developed', 'created'],
    }
    found = sum(
        1 for markers in section_map.values()
        if any(m in resume_lower for m in markers)
    )
    score += (found / len(section_map)) * 30.0

    # ── Length check (optimal: 200–800 words) ───────────────
    if 200 <= word_count <= 800:
        score += 22.0
    elif 100 <= word_count <= 1200:
        score += 14.0
    elif word_count > 0:
        score += 5.0

    # ── Action verb density ──────────────────────────────────
    action_verbs = [
        'led', 'built', 'designed', 'developed', 'implemented',
        'managed', 'created', 'improved', 'optimized', 'delivered',
        'architected', 'analyzed', 'deployed', 'collaborated',
        'mentored', 'automated', 'streamlined', 'launched',
    ]
    verb_count = sum(1 for v in action_verbs if v in resume_lower)
    if verb_count >= 6:
        score += 20.0
    elif verb_count >= 3:
        score += 12.0
    elif verb_count >= 1:
        score += 5.0

    # ── Quantified achievements ──────────────────────────────
    metrics = re.findall(r'\b\d+[%+]|\b\d{3,}\b', resume_text)
    if len(metrics) >= 4:
        score += 12.0
    elif len(metrics) >= 1:
        score += 6.0

    # ── Penalty: keyword stuffing ────────────────────────────
    skills_idx = resume_lower.find('skills')
    if skills_idx != -1:
        skills_snippet = resume_lower[skills_idx: skills_idx + 600]
        if skills_snippet.count(',') > 30:
            score -= 10.0

    return round(min(100.0, max(0.0, score)), 1)


# ═══════════════════════════════════════════════════════════════
#  FEATURE 1: SEMANTIC SIMILARITY (sentence-transformers)
#
#  Uses all-MiniLM-L6-v2 to compute true semantic cosine
#  similarity between resume and JD embeddings.
#  Falls back to TF-IDF cosine similarity if not installed.
# ═══════════════════════════════════════════════════════════════

def calculate_semantic_score(resume_text: str, job_description: str) -> dict:
    """
    Compute semantic similarity between resume and job description.

    Returns:
        score        — 0-100 semantic match score
        method       — "sentence-transformers" or "tfidf-fallback"
        explanation  — human-readable fit sentence
    """
    if SBERT_LOADED and _SBERT_MODEL is not None:
        try:
            resume_emb = _SBERT_MODEL.encode(resume_text[:3000], convert_to_tensor=True)
            jd_emb     = _SBERT_MODEL.encode(job_description[:3000], convert_to_tensor=True)
            cosine     = float(st_util.cos_sim(resume_emb, jd_emb)[0][0])
            # Scale: cosine is -1..1 but realistically 0..1 for documents
            score      = round(min(100.0, max(0.0, cosine * 130)), 1)
            method     = "sentence-transformers"
        except Exception as e:
            print(f"SBERT error: {e}")
            score, method = _tfidf_semantic_fallback(resume_text, job_description)
    else:
        score, method = _tfidf_semantic_fallback(resume_text, job_description)

    explanation = _build_semantic_explanation(resume_text, job_description, score)
    return {"score": score, "method": method, "explanation": explanation}


def _tfidf_semantic_fallback(resume_text: str, job_description: str):
    """TF-IDF cosine similarity as semantic fallback."""
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=500)
        mat = vec.fit_transform([resume_text[:3000], job_description[:3000]])
        score = round(min(100.0, float(cosine_similarity(mat[0], mat[1])[0][0]) * 180), 1)
        return score, "tfidf-fallback"
    except Exception:
        return 50.0, "tfidf-fallback"


def _build_semantic_explanation(resume_text: str, jd: str, score: float) -> str:
    """
    Generate a one-sentence natural language semantic fit explanation.
    Checks which role-domain keywords appear in both texts to form
    a specific, honest statement about alignment and gaps.
    """
    resume_lower = resume_text.lower()
    jd_lower     = jd.lower()

    # Domain categories — tech + non-tech, ordered by specificity
    domains = [
        # ── Tech ───────────────────────────────────────────────────
        ("frontend development",  ["react", "angular", "vue", "html", "css", "typescript", "ui"]),
        ("backend development",   ["spring", "node.js", "django", "fastapi", "flask", "rest api", "microservices"]),
        ("machine learning",      ["tensorflow", "pytorch", "scikit-learn", "nlp", "deep learning", "model"]),
        ("data engineering",      ["spark", "kafka", "airflow", "etl", "pipeline", "hadoop", "databricks"]),
        ("cloud & devops",        ["aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "terraform"]),
        ("data analysis",         ["pandas", "numpy", "matplotlib", "sql", "tableau", "power bi", "excel"]),
        ("mobile development",    ["android", "ios", "swift", "kotlin", "flutter", "react native"]),
        ("database management",   ["mysql", "postgresql", "mongodb", "redis", "oracle", "nosql"]),
        ("security",              ["authentication", "oauth", "jwt", "encryption", "penetration"]),
        ("testing & qa",          ["junit", "pytest", "selenium", "testing", "unit test", "tdd"]),
        # ── Non-Tech ───────────────────────────────────────────────
        ("digital marketing",     ["seo", "sem", "google analytics", "meta ads", "social media", "campaign", "ctr"]),
        ("content & copywriting", ["content writing", "copywriting", "seo writing", "blog", "editing", "content strategy"]),
        ("sales & business development", ["lead generation", "crm", "sales pipeline", "prospecting", "cold calling", "revenue"]),
        ("human resources",       ["recruitment", "talent acquisition", "onboarding", "hrms", "screening", "payroll"]),
        ("finance & accounts",    ["tally", "gst", "tds", "reconciliation", "mis reporting", "excel", "bookkeeping"]),
        ("operations",            ["operations", "sop", "vendor management", "supply chain", "inventory", "coordination"]),
    ]

    jd_domains      = [d for d, kws in domains if any(k in jd_lower for k in kws)]
    strong_matches  = [d for d, kws in domains if any(k in jd_lower for k in kws)
                       and sum(1 for k in kws if k in resume_lower) >= 2]
    weak_areas      = [d for d in jd_domains if d not in strong_matches]

    if not jd_domains:
        if score >= 70:
            return "Your resume shows strong general alignment with this job description."
        elif score >= 50:
            return "Your resume has moderate alignment with this role's requirements."
        else:
            return "Your resume has limited overlap with this job description. Consider tailoring it to the role."

    if strong_matches and weak_areas:
        strong_str = " and ".join(strong_matches[:2])
        weak_str   = " and ".join(weak_areas[:2])
        return (f"Your resume aligns well with {strong_str} responsibilities "
                f"but underrepresents {weak_str} experience required for this role.")
    elif strong_matches:
        strong_str = " and ".join(strong_matches[:2])
        if score >= 75:
            return f"Strong semantic alignment detected — your background in {strong_str} closely matches this role."
        else:
            return f"Your {strong_str} background is relevant, but adding more role-specific keywords would improve the match."
    elif weak_areas:
        weak_str = " and ".join(weak_areas[:2])
        return (f"This role emphasises {weak_str}, which appears underrepresented in your resume. "
                f"Strengthening these areas would significantly improve your match.")
    else:
        return f"Moderate semantic alignment ({score:.0f}%). Tailoring your resume language to the JD would improve your score."


# ═══════════════════════════════════════════════════════════════
#  FEATURE 2: WEAK PHRASE DETECTION
#
#  Scans resume bullet points for passive/weak language patterns
#  and flags each one with a suggested stronger alternative verb.
# ═══════════════════════════════════════════════════════════════

# Map: weak pattern → (strong verb, explanation)
WEAK_PHRASE_MAP = {
    r"\bworked on\b":           ("Developed",   "too vague — say what you built"),
    r"\bhelped (with|to)\b":    ("Contributed to", "understates your role"),
    r"\bresponsible for\b":     ("Owned",       "passive — use an action verb"),
    r"\bassisted (with|in)\b":  ("Supported",   "understates your contribution"),
    r"\bwas involved in\b":     ("Led",         "passive — be specific about your role"),
    r"\bparticipated in\b":     ("Delivered",   "vague — describe what you produced"),
    r"\btried to\b":            ("Achieved",    "signals uncertainty — remove it"),
    r"\battended\b":            ("Presented at","attending is passive; presenting is active"),
    r"\bdid (the|some)\b":      ("Executed",    "too informal and vague"),
    r"\bwas tasked with\b":     ("Designed",    "passive voice — rewrite with action verb"),
    r"\bwas part of\b":         ("Collaborated on","vague team reference"),
    r"\bknowledge of\b":        ("Proficient in","'knowledge of' lacks demonstrated evidence"),
    r"\bfamiliar with\b":       ("Experienced in","weak claim — use if you can demonstrate it"),
    r"\bexposure to\b":         ("Applied",     "vague — replace with demonstrated use"),
    r"\bbasic knowledge\b":     ("Foundational experience in","undersells your skills"),
    # ── Non-tech specific weak phrases ─────────────────────────
    r"\bhandled clients\b":     ("Managed client relationships","too vague — describe the outcome"),
    r"\bhandled accounts\b":    ("Managed accounting operations","too vague — specify the process"),
    r"\bdid (content|posting)\b":("Produced","too passive for content roles"),
    r"\bworked (on|in) (marketing|sales|hr|finance|ops)\b":
        ("Contributed to","generic — describe specific deliverable"),
    r"\bhelped (in|with) (hiring|recruitment)\b":
        ("Coordinated","understates your contribution to recruitment"),
    r"\bfiled (gst|tds|returns)\b":
        ("Prepared and filed","add compliance context and frequency"),
    r"\bdid cold calls\b":      ("Conducted outbound outreach","convert to quantified activity"),
    r"\bwrote (articles|blogs|content)\b":
        ("Produced SEO-optimized","add reach or traffic metric"),
}

def detect_weak_phrases(resume_text: str) -> list:
    """
    Find weak/passive phrases in resume bullet points.
    Returns a list of dicts:
      { original, strong_verb, reason, line_preview }
    """
    findings = []
    # Split into bullet-like lines (lines starting with -, •, *, or number)
    lines = [l.strip() for l in resume_text.split("\n") if l.strip()]
    bullet_lines = [l for l in lines if re.match(r"^[-•*>]|^\d+[.)\s]", l) or len(l) > 40]

    for line in bullet_lines[:60]:   # cap at 60 bullets
        line_lower = line.lower()
        for pattern, (strong_verb, reason) in WEAK_PHRASE_MAP.items():
            if re.search(pattern, line_lower):
                # Don't add same pattern twice for same line
                already = any(f["line_preview"] == line[:80] and
                              f["strong_verb"] == strong_verb for f in findings)
                if not already:
                    findings.append({
                        "original":     re.search(pattern, line_lower).group(0),
                        "strong_verb":  strong_verb,
                        "reason":       reason,
                        "line_preview": line[:100],
                    })
                break   # one finding per line maximum

    return findings[:8]   # return top 8


# ═══════════════════════════════════════════════════════════════
#  FEATURE 3: BEFORE/AFTER BULLET REWRITES
#
#  For each weak bullet detected, generate a rewritten version
#  using a stronger action verb and adding measurable impact.
# ═══════════════════════════════════════════════════════════════

def generate_bullet_rewrites(weak_findings: list, resume_text: str,
                             job_description: str) -> list:
    """
    Rewrite weak bullets using stronger action verbs and
    measurable-impact language. Rule-based rewriting — no LLM needed.

    Returns list of { before, after, improvement_type }
    """
    if not weak_findings:
        return []

    rewrites = []
    jd_lower = job_description.lower()

    # Extract JD context: what domain / tech stack is needed
    jd_tech = [s for s in [
        "python", "java", "react", "node.js", "machine learning", "aws",
        "docker", "kubernetes", "sql", "tensorflow", "spring", "angular",
    ] if s in jd_lower]

    for finding in weak_findings[:5]:
        original = finding["line_preview"]
        strong_verb = finding["strong_verb"]
        original_lower = original.lower()

        # ── Rewrite strategy ────────────────────────────────────
        # Step 1: Replace weak phrase with strong verb
        rewritten = re.sub(
            r"\b(worked on|helped with|helped to|responsible for|assisted with|"
            r"assisted in|was involved in|participated in|was tasked with|"
            r"was part of|did the|did some|tried to|attended)\b",
            strong_verb.lower(), original_lower, flags=re.IGNORECASE
        )

        # Step 2: Capitalise first letter
        rewritten = rewritten.strip().capitalize()

        # Step 3: Inject measurable impact if none present
        has_metric = bool(re.search(r"\d+\s*%|\d{2,}\s*(users|requests|ms|hrs?|days?)|"
                                    r"\$\d|reduced|improved|increased|saved|optimized", rewritten, re.I))

        if not has_metric:
            # Append a context-aware impact phrase
            if any(k in original_lower for k in ["deploy", "infrastructure", "server", "cloud"]):
                rewritten += ", reducing deployment time by 40%"
            elif any(k in original_lower for k in ["api", "endpoint", "service", "backend"]):
                rewritten += ", improving response time by 30%"
            elif any(k in original_lower for k in ["test", "bug", "quality", "review"]):
                rewritten += ", reducing bug rate by 25%"
            elif any(k in original_lower for k in ["data", "pipeline", "process", "automat"]):
                rewritten += ", saving 8+ hours of manual work per week"
            elif any(k in original_lower for k in ["feature", "ui", "frontend", "page", "component"]):
                rewritten += ", used by 500+ daily active users"
            elif any(k in original_lower for k in ["model", "ml", "algorithm", "train"]):
                rewritten += ", achieving 91% accuracy on the test set"
            else:
                rewritten += ", resulting in measurable performance improvement"

        # Step 4: Ensure it ends with a period
        if not rewritten.endswith("."):
            rewritten += "."

        if rewritten.lower().strip() != original.lower().strip():
            rewrites.append({
                "before":           original.strip(),
                "after":            rewritten,
                "improvement_type": finding["reason"],
            })

    return rewrites


# ═══════════════════════════════════════════════════════════════
#  FEATURE 4: CONFIDENCE INDICATORS
#
#  Returns a low/medium/high confidence level for each sub-score
#  based on how much evidence was available to compute it.
# ═══════════════════════════════════════════════════════════════

def calculate_confidence_indicators(resume_text: str,
                                    skill_score: float,
                                    exp_score: float,
                                    proj_score: float,
                                    quality_score: float,
                                    matched: set,
                                    sbert_loaded: bool) -> dict:
    """
    Returns confidence level (low / medium / high) for each score
    and an overall confidence, based on evidence density.

    High confidence = many signals found.
    Low confidence  = score based on very few signals.
    """
    resume_lower = resume_text.lower()
    word_count   = len(resume_text.split())

    def level(score, signals):
        """Map score + signal count to confidence level."""
        if signals >= 4 and score > 0:  return "high"
        if signals >= 2 and score > 0:  return "medium"
        return "low"

    # Keyword confidence — based on how many JD skills were matched
    kw_signals   = len(matched)
    kw_conf      = level(skill_score, kw_signals)

    # Experience confidence — based on date patterns and section presence
    date_count   = len(re.findall(r"\b(20\d{2}|19\d{2})\b", resume_text))
    exp_markers  = sum(1 for m in ["experience", "employment", "work history", "worked at"]
                       if m in resume_lower)
    exp_conf     = level(exp_score, date_count + exp_markers)

    # Project confidence — based on action verb + tech overlap signals
    proj_verbs   = ["built", "developed", "created", "implemented", "designed",
                    "deployed", "launched", "engineered"]
    proj_signals = sum(1 for v in proj_verbs if v in resume_lower)
    proj_conf    = level(proj_score, proj_signals)

    # Quality confidence — based on resume length and section count
    quality_conf = "high" if word_count >= 200 else ("medium" if word_count >= 80 else "low")

    # Semantic confidence — depends on whether SBERT is available
    sem_conf     = "high" if sbert_loaded else "medium"

    # Overall confidence
    conf_map     = {"high": 3, "medium": 2, "low": 1}
    avg_conf     = (conf_map[kw_conf] + conf_map[exp_conf] +
                    conf_map[proj_conf] + conf_map[quality_conf]) / 4
    overall_conf = "high" if avg_conf >= 2.5 else ("medium" if avg_conf >= 1.5 else "low")

    return {
        "overall":   overall_conf,
        "keyword":   kw_conf,
        "experience": exp_conf,
        "project":   proj_conf,
        "quality":   quality_conf,
        "semantic":  sem_conf,
        "note":      ("Scores have high confidence — sufficient resume content detected."
                      if overall_conf == "high"
                      else "Some scores have medium/low confidence — resume may be short or missing key sections.")
    }



# ═══════════════════════════════════════════════════════════════
#  ROLE TEMPLATES — keyword banks, weights, skill importance
#
#  Used by:
#    - /api/compare-roles  (What-If + multi-role comparison)
#    - Top-3 improvements engine
#    - Skill importance tagging
# ═══════════════════════════════════════════════════════════════

ROLE_TEMPLATES = {
    "Frontend Developer": {
        "jd": (
            "We are looking for a Frontend Developer with strong React and TypeScript skills. "
            "You will build responsive UIs, implement REST API integrations, write unit tests "
            "using Jest, and collaborate with designers using Figma. Experience with Tailwind CSS, "
            "Next.js, and state management (Redux or Zustand) is preferred. Knowledge of CI/CD "
            "pipelines and Git workflows is required."
        ),
        "required": [
            "react", "javascript", "typescript", "html", "css", "git",
            "rest api", "responsive design", "jest", "unit testing",
        ],
        "preferred": [
            "next.js", "tailwind", "redux", "figma", "webpack", "ci/cd", "zustand",
        ],
        "weights":   {"keyword": 0.40, "experience": 0.20, "project": 0.25, "quality": 0.15},
        "role_tip":  "Frontend roles prioritise UI project evidence and JS framework depth.",
    },
    "Java Developer": {
        "jd": (
            "We are seeking an experienced Java Developer to design and build scalable backend "
            "services using Spring Boot, REST APIs, and microservices architecture. You will work "
            "with MySQL, PostgreSQL, and Redis, and deploy on AWS or Azure using Docker and "
            "Kubernetes. Experience with JUnit, Maven, and CI/CD pipelines is required."
        ),
        "required": [
            "java", "spring boot", "rest api", "microservices", "sql",
            "git", "maven", "junit", "docker",
        ],
        "preferred": [
            "kubernetes", "aws", "azure", "redis", "postgresql", "mysql",
            "hibernate", "kafka", "ci/cd",
        ],
        "weights":   {"keyword": 0.40, "experience": 0.30, "project": 0.20, "quality": 0.10},
        "role_tip":  "Java backend roles weight experience heavily — include work history dates.",
    },
    "Data Analyst": {
        "jd": (
            "We are looking for a Data Analyst skilled in SQL, Python, and data visualisation. "
            "You will query large datasets, build dashboards in Power BI or Tableau, and "
            "communicate insights to stakeholders. Proficiency in Pandas, NumPy, and Excel is "
            "expected. Experience with statistical analysis and A/B testing is a plus."
        ),
        "required": [
            "sql", "python", "pandas", "numpy", "excel",
            "data visualisation", "statistics",
        ],
        "preferred": [
            "power bi", "tableau", "matplotlib", "a/b testing", "spark",
            "machine learning", "jupyter",
        ],
        "weights":   {"keyword": 0.35, "experience": 0.25, "project": 0.25, "quality": 0.15},
        "role_tip":  "Data Analyst roles need both SQL evidence and visualisation tool mentions.",
    },
    "ML Engineer": {
        "jd": (
            "We are hiring a Machine Learning Engineer to design, train, and deploy ML models. "
            "Strong Python skills are essential, along with experience in TensorFlow or PyTorch, "
            "scikit-learn, and MLflow. You will work on NLP, computer vision, or recommendation "
            "systems. AWS SageMaker, Docker, and REST API experience is required."
        ),
        "required": [
            "python", "machine learning", "scikit-learn", "tensorflow",
            "pytorch", "docker", "rest api", "git",
        ],
        "preferred": [
            "mlflow", "aws", "nlp", "computer vision", "spark",
            "kubernetes", "fastapi", "deep learning",
        ],
        "weights":   {"keyword": 0.40, "experience": 0.20, "project": 0.30, "quality": 0.10},
        "role_tip":  "ML roles prize project depth — include model accuracy and dataset size.",
    },
    "DevOps Engineer": {
        "jd": (
            "We are looking for a DevOps Engineer to manage CI/CD pipelines, container "
            "orchestration, and cloud infrastructure. You will work with Docker, Kubernetes, "
            "Terraform, Jenkins, and AWS or GCP. Scripting in Python or Bash and monitoring "
            "with Prometheus/Grafana are required."
        ),
        "required": [
            "docker", "kubernetes", "aws", "ci/cd", "terraform",
            "linux", "git", "bash",
        ],
        "preferred": [
            "jenkins", "ansible", "gcp", "prometheus", "grafana",
            "python", "azure", "helm",
        ],
        "weights":   {"keyword": 0.45, "experience": 0.30, "project": 0.15, "quality": 0.10},
        "role_tip":  "DevOps roles need infrastructure keywords — mention cloud deployments.",
    },

    # ── MARKETING DOMAIN ──────────────────────────────────────
    "Digital Marketing Intern": {
        "jd": (
            "We are looking for a Digital Marketing Intern to support our marketing team. "
            "You will assist with SEO, social media management, content creation, and campaign "
            "performance tracking. Familiarity with Google Analytics, Meta Ads, and Canva is preferred. "
            "Strong written communication, creativity, and interest in performance marketing are required."
        ),
        "required": [
            "seo", "social media", "content creation", "google analytics",
            "email marketing", "copywriting",
        ],
        "preferred": [
            "meta ads", "google ads", "canva", "hootsuite", "sem", "campaign management",
            "ctr", "engagement metrics", "wordpress",
        ],
        "weights":   {"keyword": 0.35, "experience": 0.15, "project": 0.30, "quality": 0.20},
        "role_tip":  "Marketing roles prize measurable outcomes — add campaign metrics, follower growth, engagement rates.",
        "domain":    "Marketing",
        "weak_phrase_replacements": {
            "worked on social media": "Managed social media content strategy and contributed to audience engagement growth",
            "helped with marketing":  "Supported marketing campaign execution and performance tracking",
            "did content":            "Produced SEO-optimized content targeting key audience segments",
            "handled campaigns":      "Executed digital marketing campaigns and monitored performance metrics",
        },
    },
    "SEO Executive": {
        "jd": (
            "We are hiring an SEO Executive to improve organic search rankings and drive web traffic. "
            "You will conduct keyword research, on-page and off-page optimisation, and technical SEO audits. "
            "Experience with Google Search Console, SEMrush or Ahrefs, and content optimization is required."
        ),
        "required": [
            "seo", "keyword research", "on-page seo", "google search console",
            "link building", "content optimization",
        ],
        "preferred": [
            "semrush", "ahrefs", "technical seo", "backlink analysis",
            "site audit", "google analytics", "wordpress",
        ],
        "weights":   {"keyword": 0.45, "experience": 0.20, "project": 0.20, "quality": 0.15},
        "role_tip":  "SEO roles need tool mentions — add SEMrush, Ahrefs, Google Search Console explicitly.",
        "domain":    "Marketing",
        "weak_phrase_replacements": {
            "worked on seo":      "Implemented on-page and off-page SEO strategies to improve organic rankings",
            "helped with seo":    "Contributed to SEO audits and keyword optimization initiatives",
            "did keyword research":"Conducted comprehensive keyword research to identify high-opportunity search terms",
        },
    },
    "Content Strategist": {
        "jd": (
            "We are looking for a Content Strategist to plan and execute content initiatives. "
            "You will develop content calendars, write long-form SEO content, manage blog publishing, "
            "and collaborate with design and marketing teams. Strong writing, research, and SEO skills required."
        ),
        "required": [
            "content strategy", "seo writing", "content calendar", "copywriting",
            "editing", "research",
        ],
        "preferred": [
            "wordpress", "hubspot", "grammarly", "canva", "content marketing",
            "email newsletters", "social media content",
        ],
        "weights":   {"keyword": 0.35, "experience": 0.20, "project": 0.30, "quality": 0.15},
        "role_tip":  "Content roles reward writing samples and portfolio links — mention published work.",
        "domain":    "Marketing",
        "weak_phrase_replacements": {
            "wrote articles":     "Produced SEO-optimized long-form articles driving organic traffic growth",
            "worked on content":  "Developed and executed content strategy aligned with brand objectives",
            "helped with blog":   "Managed blog content pipeline and publishing schedule for consistent audience engagement",
        },
    },

    # ── SALES / BUSINESS DEVELOPMENT DOMAIN ──────────────────
    "Sales Executive": {
        "jd": (
            "We are looking for a Sales Executive to drive revenue growth and manage client relationships. "
            "You will generate leads, conduct product demos, follow up on prospects, and close deals. "
            "Experience with CRM tools (Salesforce, HubSpot), cold calling, and meeting sales targets is required."
        ),
        "required": [
            "lead generation", "crm", "sales pipeline", "client communication",
            "cold calling", "target achievement",
        ],
        "preferred": [
            "salesforce", "hubspot", "prospecting", "negotiation", "closing",
            "revenue growth", "b2b sales", "demo presentation",
        ],
        "weights":   {"keyword": 0.30, "experience": 0.35, "project": 0.20, "quality": 0.15},
        "role_tip":  "Sales roles need numbers — add revenue targets hit, conversion rates, client counts.",
        "domain":    "Sales",
        "weak_phrase_replacements": {
            "handled clients":    "Managed client relationships and supported pipeline progression to drive conversion",
            "worked in sales":    "Executed outbound sales activities contributing to revenue growth and target achievement",
            "helped with leads":  "Supported lead qualification and prospecting to build a healthy sales pipeline",
            "did cold calls":     "Conducted cold outreach campaigns resulting in qualified lead generation",
        },
    },
    "Business Development Associate": {
        "jd": (
            "We are seeking a Business Development Associate to identify growth opportunities and build "
            "client partnerships. You will research markets, qualify leads, prepare proposals, and support "
            "senior BD managers. Strong communication, research skills, and CRM proficiency are required."
        ),
        "required": [
            "market research", "lead generation", "client acquisition",
            "proposal writing", "communication",
        ],
        "preferred": [
            "crm", "linkedin outreach", "partnership development", "competitive analysis",
            "b2b", "pitch deck", "revenue targets",
        ],
        "weights":   {"keyword": 0.30, "experience": 0.30, "project": 0.25, "quality": 0.15},
        "role_tip":  "BD roles prize research + communication evidence — quantify outreach and proposal success.",
        "domain":    "Sales",
        "weak_phrase_replacements": {
            "worked on business development": "Drove business development initiatives identifying new market opportunities",
            "helped with proposals":          "Prepared compelling client proposals contributing to partnership acquisition",
        },
    },

    # ── HUMAN RESOURCES DOMAIN ───────────────────────────────
    "HR Intern": {
        "jd": (
            "We are looking for an HR Intern to support our human resources team. "
            "You will assist with job postings, resume screening, interview scheduling, onboarding, "
            "and HR documentation. Familiarity with HRMS tools, strong organisational skills, "
            "and attention to detail are required."
        ),
        "required": [
            "recruitment", "resume screening", "interview scheduling",
            "onboarding", "hr documentation",
        ],
        "preferred": [
            "hrms", "talent acquisition", "employee engagement", "payroll",
            "policy documentation", "exit formalities", "darwinbox", "zoho people",
        ],
        "weights":   {"keyword": 0.35, "experience": 0.15, "project": 0.30, "quality": 0.20},
        "role_tip":  "HR roles need process language — describe screening, onboarding, coordination steps clearly.",
        "domain":    "HR",
        "weak_phrase_replacements": {
            "helped in hiring":    "Assisted in candidate screening and interview coordination to streamline recruitment",
            "worked in hr":        "Supported HR operations including onboarding, documentation, and employee engagement",
            "helped with onboarding": "Coordinated onboarding activities ensuring smooth integration of new joiners",
            "did recruitment":     "Executed end-to-end recruitment support including job posting, screening, and offer coordination",
        },
    },
    "Talent Acquisition Associate": {
        "jd": (
            "We are hiring a Talent Acquisition Associate to manage full-cycle recruiting. "
            "You will source candidates, conduct initial screens, coordinate interviews, and manage "
            "offer processes. Experience with ATS, LinkedIn Recruiter, and stakeholder management required."
        ),
        "required": [
            "talent acquisition", "sourcing", "candidate screening",
            "interview coordination", "ats",
        ],
        "preferred": [
            "linkedin recruiter", "naukri", "boolean search", "employer branding",
            "offer management", "jd creation", "pipeline management",
        ],
        "weights":   {"keyword": 0.40, "experience": 0.25, "project": 0.20, "quality": 0.15},
        "role_tip":  "TA roles need sourcing channel mentions — add LinkedIn, Naukri, Boolean search explicitly.",
        "domain":    "HR",
        "weak_phrase_replacements": {
            "helped with hiring":  "Managed end-to-end talent acquisition for multiple open positions simultaneously",
            "screened resumes":    "Evaluated and shortlisted candidates through structured screening aligned with role requirements",
        },
    },

    # ── FINANCE / ACCOUNTS DOMAIN ────────────────────────────
    "Finance Intern": {
        "jd": (
            "We are looking for a Finance Intern to support our accounts and finance team. "
            "You will assist with bookkeeping, account reconciliation, MIS reporting, and financial data entry. "
            "Proficiency in Advanced Excel, Tally, and basic knowledge of GST and TDS is required."
        ),
        "required": [
            "excel", "tally", "bookkeeping", "account reconciliation",
            "data entry", "financial reporting",
        ],
        "preferred": [
            "gst", "tds", "mis reporting", "budgeting", "accounts payable",
            "accounts receivable", "pivot tables", "vlookup",
        ],
        "weights":   {"keyword": 0.40, "experience": 0.20, "project": 0.25, "quality": 0.15},
        "role_tip":  "Finance roles need tool specificity — mention Tally version, Excel functions, GST/TDS exposure.",
        "domain":    "Finance",
        "weak_phrase_replacements": {
            "worked on accounts":  "Supported account reconciliation and maintained accurate financial records",
            "helped with finance": "Assisted in financial reporting and MIS preparation for routine review cycles",
            "did data entry":      "Managed financial data entry with high accuracy supporting monthly close processes",
            "worked on excel":     "Utilised Advanced Excel (VLOOKUP, Pivot Tables) to streamline financial data analysis",
        },
    },
    "Accounts Executive": {
        "jd": (
            "We are seeking an Accounts Executive to manage day-to-day accounting operations. "
            "You will handle GST filing, TDS returns, vendor payments, bank reconciliation, and "
            "monthly MIS. Proficiency in Tally ERP, Advanced Excel, and knowledge of Indian taxation required."
        ),
        "required": [
            "tally", "gst filing", "tds", "bank reconciliation",
            "accounts payable", "mis reporting",
        ],
        "preferred": [
            "advanced excel", "sap", "accounts receivable", "budgeting",
            "audit support", "invoice processing", "zoho books",
        ],
        "weights":   {"keyword": 0.45, "experience": 0.25, "project": 0.20, "quality": 0.10},
        "role_tip":  "Accounts roles need compliance keywords — add GST, TDS, reconciliation with numbers where possible.",
        "domain":    "Finance",
        "weak_phrase_replacements": {
            "handled accounts": "Managed end-to-end accounting operations including GST filing and bank reconciliation",
            "filed gst":        "Prepared and filed GST returns ensuring compliance with regulatory timelines",
        },
    },

    # ── OPERATIONS DOMAIN ─────────────────────────────────────
    "Operations Executive": {
        "jd": (
            "We are looking for an Operations Executive to oversee daily operational activities. "
            "You will coordinate between departments, manage workflows, maintain MIS, and ensure "
            "SOP compliance. Strong organisational skills, Excel proficiency, and process orientation required."
        ),
        "required": [
            "operations management", "process coordination", "mis reporting",
            "sop", "workflow management", "excel",
        ],
        "preferred": [
            "vendor management", "supply chain", "erp", "cross-functional coordination",
            "inventory management", "project coordination", "data reporting",
        ],
        "weights":   {"keyword": 0.35, "experience": 0.30, "project": 0.20, "quality": 0.15},
        "role_tip":  "Ops roles prize process efficiency — quantify turnaround time, error reduction, throughput gains.",
        "domain":    "Operations",
        "weak_phrase_replacements": {
            "handled operations":  "Managed daily operational workflows ensuring process efficiency and SOP adherence",
            "worked on processes": "Optimised operational processes reducing turnaround time and improving throughput",
            "helped with coordination": "Coordinated cross-functional activities to ensure seamless operational delivery",
        },
    },
    "Supply Chain Intern": {
        "jd": (
            "We are seeking a Supply Chain Intern to support procurement and logistics operations. "
            "You will assist with vendor coordination, inventory tracking, purchase orders, "
            "and supply chain reporting. Excel proficiency and analytical skills are required."
        ),
        "required": [
            "supply chain", "inventory management", "procurement",
            "vendor coordination", "excel",
        ],
        "preferred": [
            "erp", "sap", "logistics", "demand planning", "purchase orders",
            "warehouse management", "data analysis",
        ],
        "weights":   {"keyword": 0.40, "experience": 0.20, "project": 0.25, "quality": 0.15},
        "role_tip":  "Supply chain roles need operational specificity — mention inventory levels, vendor counts, order volumes.",
        "domain":    "Operations",
        "weak_phrase_replacements": {
            "worked on supply chain": "Supported supply chain operations including procurement coordination and inventory tracking",
            "helped with logistics":  "Assisted logistics team in optimising delivery schedules and vendor communication",
        },
    },

    # ── CONTENT / MEDIA DOMAIN ────────────────────────────────
    "Content Writer": {
        "jd": (
            "We are looking for a Content Writer to produce high-quality written content. "
            "You will write blog posts, website copy, social media content, and email campaigns. "
            "Strong writing, editing, SEO awareness, and research skills are required. "
            "Portfolio of published work preferred."
        ),
        "required": [
            "content writing", "copywriting", "editing", "seo writing",
            "research", "blog writing",
        ],
        "preferred": [
            "wordpress", "grammarly", "content calendar", "social media copy",
            "email marketing", "headline writing", "style guides",
        ],
        "weights":   {"keyword": 0.30, "experience": 0.15, "project": 0.40, "quality": 0.15},
        "role_tip":  "Content roles live and die by portfolio — link to published work, blog, or writing samples.",
        "domain":    "Content",
        "weak_phrase_replacements": {
            "wrote content":        "Produced SEO-optimized content driving organic traffic and audience engagement",
            "worked on writing":    "Created compelling written content across multiple formats aligned with brand voice",
            "helped with blog":     "Developed and published blog content targeting key search intent and reader engagement",
            "did social media posts": "Crafted platform-specific social media content contributing to follower growth and engagement",
        },
    },
    "Copywriter": {
        "jd": (
            "We are hiring a Copywriter to craft persuasive, brand-consistent copy across channels. "
            "You will write ad copy, landing pages, email campaigns, and product descriptions. "
            "Strong understanding of brand voice, audience psychology, and conversion-focused writing required."
        ),
        "required": [
            "copywriting", "ad copy", "brand voice", "conversion writing",
            "editing", "creative writing",
        ],
        "preferred": [
            "a/b testing copy", "email campaigns", "landing page copy",
            "product descriptions", "ux writing", "storytelling",
        ],
        "weights":   {"keyword": 0.30, "experience": 0.20, "project": 0.35, "quality": 0.15},
        "role_tip":  "Copywriting roles need conversion evidence — mention CTR, open rates, or campaign outcomes.",
        "domain":    "Content",
        "weak_phrase_replacements": {
            "wrote ads":         "Developed high-converting ad copy achieving improved CTR and campaign performance",
            "worked on copy":    "Crafted brand-aligned copy for multiple channels driving measurable engagement outcomes",
            "helped with emails":"Produced email campaign copy contributing to improved open rates and click-through performance",
        },
    },

}


def tag_skill_importance(skill: str, role_name: str) -> str:
    """
    Return High / Medium / Low importance tag for a missing skill
    based on whether it is required or preferred in the role template.
    """
    template = ROLE_TEMPLATES.get(role_name, {})
    required  = [s.lower() for s in template.get("required",  [])]
    preferred = [s.lower() for s in template.get("preferred", [])]
    s = skill.lower()
    if s in required:  return "High"
    if s in preferred: return "Medium"
    return "Low"


def get_skill_fix_hint(skill: str, role_name: str) -> str:
    """
    Return a short, actionable tip for adding a missing skill.
    """
    hints = {
        "typescript":        "Add a TypeScript project or mention TS usage in existing React work.",
        "react":             "Build a small React project and add it to your GitHub.",
        "docker":            "Add a Dockerfile to one of your projects and mention it.",
        "kubernetes":        "Describe any container orchestration work or personal k8s cluster.",
        "aws":               "Mention any AWS services used (S3, EC2, Lambda) in projects.",
        "rest api":          "Describe API endpoints you built or consumed in project descriptions.",
        "junit":             "Add unit test coverage section to your Java projects.",
        "sql":               "Include database query examples or schema design in project bullets.",
        "postgresql":        "Mention PostgreSQL in your project tech stack.",
        "power bi":          "Create a sample Power BI dashboard and add it to your portfolio.",
        "tableau":           "Create a Tableau public visualisation and link it.",
        "machine learning":  "Add an ML project — even a Kaggle notebook counts.",
        "scikit-learn":      "Use scikit-learn in a classification or regression project.",
        "tensorflow":        "Add a TensorFlow/Keras model training example to GitHub.",
        "git":               "Ensure your GitHub profile is linked and active.",
        "ci/cd":             "Add a GitHub Actions workflow file to any project.",
        "microservices":     "Describe how your backend services communicate via APIs.",
        "spring boot":       "Add a Spring Boot REST API project to your portfolio.",
        "pandas":            "Include pandas data analysis in a project with real datasets.",
        "statistics":        "Mention statistical methods (mean, variance, regression) in projects.",
    }
    # ── Non-tech skill hints ───────────────────────────────────
    non_tech_hints = {
        # Marketing
        "seo":                   "Add SEO-related projects or mention on-page/off-page work with results.",
        "google analytics":      "Mention Google Analytics in internship or project work with a metric.",
        "meta ads":              "Include any paid social media campaign experience with budget/results.",
        "content calendar":      "Describe a content planning project with posting frequency and reach.",
        "canva":                 "Mention Canva for visual content creation in projects or internships.",
        "social media":          "Add social media management work with follower count or engagement rate.",
        "sem":                   "Mention SEM/Google Ads experience with CTR or conversion data.",
        # Sales
        "crm":                   "Mention any CRM tool used (Salesforce, HubSpot, Zoho) in work experience.",
        "lead generation":       "Describe a lead generation activity with number of leads or conversion rate.",
        "sales pipeline":        "Include pipeline management in experience bullets with deal counts.",
        "negotiation":           "Add examples of client negotiations or deal closures.",
        "cold calling":          "Mention cold outreach experience with call volumes or connect rates.",
        # HR
        "recruitment":           "Describe recruitment support work — sourcing channels, screening volume.",
        "talent acquisition":    "Add ATS or LinkedIn Recruiter usage in your experience.",
        "onboarding":            "Mention onboarding activities — documentation, orientation, buddy assignment.",
        "hrms":                  "Name specific HRMS tools used (Darwinbox, Zoho People, Keka).",
        "interview scheduling":  "Include interview coordination work with volume (e.g., 20+ interviews/week).",
        # Finance
        "tally":                 "Mention Tally ERP version and specific accounting tasks performed.",
        "gst filing":            "Add GST return filing experience with filing frequency and entity type.",
        "tds":                   "Include TDS computation and filing in your experience bullets.",
        "bank reconciliation":   "Describe reconciliation work with volume (e.g., 500+ transactions/month).",
        "mis reporting":         "Mention MIS report creation with frequency and stakeholder audience.",
        "advanced excel":        "Specify Excel functions used: VLOOKUP, Pivot Tables, SUMIF, dashboards.",
        # Operations
        "sop":                   "Mention SOPs you created or followed — describe the process area.",
        "vendor management":     "Add vendor coordination work with number of vendors and category.",
        "supply chain":          "Include supply chain exposure — procurement, logistics, or inventory work.",
        "inventory management":  "Describe inventory tracking work with volume or accuracy improvements.",
        # Content
        "content writing":       "Link to published work, blog, or writing portfolio.",
        "seo writing":           "Mention SEO-optimized articles with keyword targets and traffic results.",
        "copywriting":           "Add ad copy or landing page work with conversion or engagement metrics.",
        "content calendar":      "Describe content planning and scheduling with posting cadence.",
        "editing":               "Mention editing volume (e.g., reviewed 20+ articles/month) and style guides used.",
    }

    combined_hints = {**hints, **non_tech_hints}
    return combined_hints.get(skill.lower(),
                              f"Add {skill} to your skills section and demonstrate it in a project or internship context.")


def run_role_analysis(resume_text: str, role_name: str) -> dict:
    """
    Run the full scoring pipeline for a single role template.
    Returns a structured result for that role.
    """
    template     = ROLE_TEMPLATES[role_name]
    jd           = template["jd"]
    weights      = template["weights"]
    required     = set(template["required"])
    preferred    = set(template["preferred"])

    # ── Scoring ──────────────────────────────────────────────
    base_score   = calculate_match_score(resume_text, jd)
    exp_score    = calculate_experience_score(resume_text, jd)
    proj_score   = calculate_project_score(resume_text, jd)
    quality_score= calculate_resume_quality_score(resume_text)

    composite = round(min(100.0, max(0.0,
                                     base_score    * weights["keyword"]    +
                                     exp_score     * weights["experience"] +
                                     proj_score    * weights["project"]    +
                                     quality_score * weights["quality"]
                                     )), 1)

    # ── Keyword gap ──────────────────────────────────────────
    resume_kws   = extract_keywords(resume_text)
    jd_kws       = extract_keywords(jd)
    matched      = resume_kws & jd_kws
    missing_all  = (required | preferred) - resume_kws

    # ── Tag missing skills ───────────────────────────────────
    missing_tagged = []
    for skill in sorted(missing_all)[:12]:
        importance = tag_skill_importance(skill, role_name)
        missing_tagged.append({
            "skill":      skill,
            "importance": importance,
            "fix_hint":   get_skill_fix_hint(skill, role_name),
        })
    # Sort: High first
    priority = {"High": 0, "Medium": 1, "Low": 2}
    missing_tagged.sort(key=lambda x: priority[x["importance"]])

    # ── Semantic ─────────────────────────────────────────────
    sem = calculate_semantic_score(resume_text, jd)

    return {
        "role":            role_name,
        "atsScore":        composite,
        "keywordScore":    round(base_score, 1),
        "semanticScore":   sem["score"],
        "experienceScore": round(exp_score, 1),
        "projectScore":    round(proj_score, 1),
        "qualityScore":    round(quality_score, 1),
        "matchedSkills":   sorted(matched & required)[:10],
        "missingSkills":   missing_tagged,
        "roleTip":         template["role_tip"],
        "semanticFit":     sem["explanation"],
    }


def compute_top3_improvements(resume_text: str, role_name: str,
                              current_score: float,
                              matched: set, missing_tagged: list,
                              weak_phrases: list) -> list:
    """
    Compute the 3 highest-impact improvements with estimated ATS gain.

    Each improvement has:
      title, description, action, estimated_gain (%), priority
    """
    improvements = []
    resume_lower = resume_text.lower()

    # ── High-importance missing skills ───────────────────────
    high_missing = [m for m in missing_tagged if m["importance"] == "High"]
    if len(high_missing) >= 2:
        skills_str = " and ".join(s["skill"] for s in high_missing[:2])
        gain = min(12, len(high_missing) * 4)
        improvements.append({
            "title":          f"Add {skills_str} to your resume",
            "description":    f"These are core required skills for {role_name} that are missing.",
            "action":         f"Add projects or work experience demonstrating {skills_str}.",
            "estimated_gain": gain,
            "priority":       1,
            "icon":           "🎯",
        })
    elif len(high_missing) == 1:
        skill = high_missing[0]["skill"]
        improvements.append({
            "title":          f"Add {skill} experience",
            "description":    f"{skill} is a required skill for {role_name}.",
            "action":         high_missing[0]["fix_hint"],
            "estimated_gain": 8,
            "priority":       1,
            "icon":           "🎯",
        })

    # ── Weak bullets → rewrite for measurable impact ─────────
    if len(weak_phrases) >= 2:
        improvements.append({
            "title":          "Rewrite weak bullet points with measurable impact",
            "description":    (f"Found {len(weak_phrases)} bullets using passive language "
                               f"('worked on', 'helped with', 'responsible for'). "
                               f"Strong action verbs improve ATS parsing and recruiter impression."),
            "action":         "Start each bullet with a strong verb: Built, Designed, Optimised, Led, Deployed.",
            "estimated_gain": min(8, len(weak_phrases) * 2),
            "priority":       2,
            "icon":           "✍️",
        })
    elif len(weak_phrases) == 1:
        improvements.append({
            "title":          "Strengthen one passive bullet point",
            "description":    'Detected: "' + weak_phrases[0]['line_preview'][:60] + '..."',
            "action":         f"Replace with strong verb. Suggested: {weak_phrases[0]['strong_verb']}.",
            "estimated_gain": 4,
            "priority":       2,
            "icon":           "✍️",
        })

    # ── Metrics detection ────────────────────────────────────
    has_metrics = bool(re.search(
        r"\d+\s*%|\d{2,}\s*(users|requests|ms|hours?|days?)|"
        r"\$\d|reduced|improved|increased|3x|5x",
        resume_text, re.I
    ))
    if not has_metrics:
        improvements.append({
            "title":          "Add measurable achievements (numbers, %, scale)",
            "description":    "Resumes with quantified impact score 30% higher in ATS systems.",
            "action":         ("Add metrics to project bullets: "
                               "e.g. 'Reduced load time by 40%', 'Serving 500+ daily users', "
                               "'Improved accuracy from 78% to 91%'."),
            "estimated_gain": 7,
            "priority":       2 if len(improvements) < 2 else 3,
            "icon":           "📈",
        })

    # ── Missing project / portfolio section ─────────────────
    has_projects = any(k in resume_lower for k in
                       ["project", "built", "developed", "created", "implemented",
                        "campaign", "managed", "coordinated", "published", "filed"])
    # Domain-aware project tip
    template   = ROLE_TEMPLATES.get(role_name, {})
    role_domain = template.get("domain", "Technology")
    project_tips = {
        "Marketing":   "Add a campaign project — include platform, budget range, and measurable result (CTR, reach, engagement).",
        "Sales":       "Add a sales achievement — include lead count, conversion rate, or revenue contribution.",
        "HR":          "Add an HR project — describe a recruitment drive, onboarding initiative, or HR process improvement.",
        "Finance":     "Add a finance project — describe a reconciliation, reporting, or compliance task with volume metrics.",
        "Operations":  "Add an operations project — describe a process you optimised with before/after metrics.",
        "Content":     "Link to your writing portfolio, published articles, or content campaigns with reach/engagement data.",
    }
    project_action = project_tips.get(role_domain,
                                      "Add 2–3 projects with tech stack, your role, and measurable outcome.")

    if not has_projects:
        improvements.append({
            "title":          "Add portfolio / project evidence",
            "description":    f"No project or portfolio evidence detected. This is critical for {role_name} roles.",
            "action":         project_action,
            "estimated_gain": 9,
            "priority":       1,
            "icon":           "🔧",
        })

    # ── Education / certification check ──────────────────────
    has_certs = any(k in resume_lower for k in
                    ["certified", "certification", "aws certified", "coursera",
                     "udemy", "google certified", "nptel"])
    med_missing = [m for m in missing_tagged if m["importance"] == "Medium"]
    if not has_certs and len(med_missing) >= 2:
        skills_str = " and ".join(s["skill"] for s in med_missing[:2])
        improvements.append({
            "title":          f"Add certifications for {skills_str}",
            "description":    f"Preferred skills {skills_str} can be demonstrated via certs.",
            "action":         f"Free/low-cost certs: AWS Free Tier, Google Skillshop, Coursera.",
            "estimated_gain": 5,
            "priority":       3,
            "icon":           "🎓",
        })

    # ── Sort by priority and return top 3 ────────────────────
    improvements.sort(key=lambda x: (x["priority"], -x["estimated_gain"]))
    top3 = improvements[:3]

    # ── Add "potential score" to each improvement ────────────
    running = current_score
    for imp in top3:
        running = min(100, running + imp["estimated_gain"])
        imp["potential_score"] = round(running, 1)

    return top3

# ═══════════════════════════════════════════════════════════════
#  MAIN ANALYSIS ENDPOINT
# ═══════════════════════════════════════════════════════════════

@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze a resume against a job description.

    Request JSON:
    {
        "resume_text": "...",
        "job_description": "..."
    }

    Response JSON:
    {
        "matchScore":             78.5,    combined TF-IDF + RF score
        "keywordsMatched":        "Java,Spring,REST",
        "missingKeywords":        "Docker,AWS",
        "feedbackPoints":         "- Strong backend...",
        "improvementSuggestions": "1. Add cloud experience...",
        "summary":                "Experienced Java developer...",
        "rfConfidence":           0.82,   RF relevance confidence (0-1)
        "rfRelevant":             true,   RF classification result
        "scoringMethod":          "RF+TF-IDF" or "TF-IDF"
    }
    """
    try:
        data = request.get_json()
        resume_text     = data.get("resume_text", "")
        job_description = data.get("job_description", "")

        if not resume_text or not job_description:
            return jsonify({"error": "resume_text and job_description are required"}), 400

        # ── Step 1: TF-IDF Cosine Similarity (base score) ────
        base_score = calculate_match_score(resume_text, job_description)

        # ── Step 2: Random Forest boost (if model available) ─
        rf_result = {}
        final_score = base_score

        if RF_LOADED:
            rf_result = predict_relevance(
                resume_text, job_description,
                RF_VECTORIZER, RF_MODEL
            )
            # Apply RF boost to base score (clamped 0-100)
            final_score = min(100.0, max(0.0, base_score + rf_result.get("rf_score_boost", 0)))
            scoring_method = "RF+TF-IDF"
        else:
            rf_result = {"rf_relevant": True, "rf_confidence": 0.5, "rf_score_boost": 0.0}
            scoring_method = "TF-IDF"

        # ── Step 3: Keyword extraction ───────────────────────
        resume_keywords = extract_keywords(resume_text)
        jd_keywords     = extract_keywords(job_description)
        matched = resume_keywords.intersection(jd_keywords)
        missing = jd_keywords - resume_keywords

        # ── Step 4: Generate feedback ────────────────────────
        feedback, suggestions = generate_feedback(
            resume_text, job_description, final_score, matched, missing
        )

        # ── Step 5: Generate summary ─────────────────────────
        summary = generate_summary(resume_text)

        # ── Step 6: Multi-dimensional sub-scores ─────────────
        skill_score   = calculate_skill_score(matched, jd_keywords)
        exp_score     = calculate_experience_score(resume_text, job_description)
        proj_score    = calculate_project_score(resume_text, job_description)
        quality_score = calculate_resume_quality_score(resume_text)

        # ── Step 7: Weighted composite score ──────────────────
        #
        # matchScore is now a TRUE composite, not just TF-IDF.
        #
        # Default weights (must sum to 100):
        #   Keyword / Skill match  : 40%  — does the resume contain the right skills?
        #   Experience relevance   : 25%  — does work history support the role?
        #   Project depth          : 25%  — is there practical evidence of those skills?
        #   Resume quality         : 10%  — is the resume well-structured and ATS-friendly?
        #
        # The raw TF-IDF + RF score (final_score) is used ONLY as the
        # keyword component, replacing the stand-alone skill_score for
        # this weight because it carries semantic signal from TF-IDF.
        #
        W_KEYWORD    = 0.40
        W_EXPERIENCE = 0.25
        W_PROJECT    = 0.25
        W_QUALITY    = 0.10

        composite_score = (
                final_score   * W_KEYWORD    +   # TF-IDF + RF keyword signal (0-100)
                exp_score     * W_EXPERIENCE +   # experience heuristic (0-100)
                proj_score    * W_PROJECT    +   # project depth heuristic (0-100)
                quality_score * W_QUALITY        # resume quality heuristic (0-100)
        )
        composite_score = round(min(100.0, max(0.0, composite_score)), 1)

        # Update feedback to use composite score for accurate messaging
        feedback, suggestions = generate_feedback(
            resume_text, job_description, composite_score, matched, missing
        )
        # Re-generate summary with the updated context
        summary = generate_summary(resume_text)

        # ── FEATURE 1: Semantic similarity ────────────────────
        semantic_result  = calculate_semantic_score(resume_text, job_description)
        semantic_score   = semantic_result["score"]
        semantic_method  = semantic_result["method"]
        semantic_fit     = semantic_result["explanation"]

        # ── FEATURE 2: Weak phrase detection ──────────────────
        weak_phrases     = detect_weak_phrases(resume_text)

        # ── FEATURE 3: Before/After bullet rewrites ───────────
        bullet_rewrites  = generate_bullet_rewrites(weak_phrases, resume_text, job_description)

        # ── FEATURE 4: Confidence indicators ──────────────────
        confidence       = calculate_confidence_indicators(
            resume_text, skill_score, exp_score,
            proj_score, quality_score, matched, SBERT_LOADED
        )

        return jsonify({
            # ── Primary score: weighted composite
            "matchScore":             composite_score,

            # ── Raw keyword-only score (TF-IDF + RF)
            "keywordScore":           round(final_score, 1),

            # ── FEATURE 1: Semantic score ──────────────────────
            "semanticScore":          semantic_score,
            "semanticMethod":         semantic_method,

            # ── FEATURE 5: Semantic fit explanation ───────────
            "semanticFitExplanation": semantic_fit,

            # ── Keyword analysis
            "keywordsMatched":        ", ".join(sorted(matched)),
            "missingKeywords":        ", ".join(sorted(missing)),

            # ── Text output
            "feedbackPoints":         feedback,
            "improvementSuggestions": suggestions,
            "summary":                summary,

            # ── FEATURE 2: Weak phrase findings ───────────────
            "weakPhrases":            weak_phrases,

            # ── FEATURE 3: Before/After rewrites ──────────────
            "bulletRewrites":         bullet_rewrites,

            # ── FEATURE 4: Confidence breakdown ───────────────
            "confidenceIndicators":   confidence,

            # ── ML metadata
            "rfConfidence":           rf_result.get("rf_confidence", 0.5),
            "rfRelevant":             rf_result.get("rf_relevant", True),
            "rfScoreBoost":           rf_result.get("rf_score_boost", 0.0),
            "scoringMethod":          (f"Composite+Semantic({semantic_method})"),

            # ── Sub-scores
            "skillScore":         skill_score,
            "experienceScore":    exp_score,
            "projectScore":       proj_score,
            "resumeQualityScore": quality_score,

            # ── Top 3 improvements with ATS gain estimate
            "top3Improvements":   compute_top3_improvements(
                resume_text, "Frontend Developer", composite_score,
                matched,
                [{"skill": k, "importance": "High", "fix_hint": get_skill_fix_hint(k, "Frontend Developer")}
                 for k in sorted(missing)[:8]],
                weak_phrases
            ),

            # ── Weights used
            "weights": {
                "keyword":    int(W_KEYWORD    * 100),
                "experience": int(W_EXPERIENCE * 100),
                "project":    int(W_PROJECT    * 100),
                "quality":    int(W_QUALITY    * 100),
            },
        })

    except Exception as e:
        print(f"Error in /analyze: {e}")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════
#  GENERATE IMPROVED RESUME ENDPOINT (from previous implementation)
# ═══════════════════════════════════════════════════════════════

@app.route("/generate-improved-resume", methods=["POST"])
def generate_improved_resume():
    """
    Generate structured improved resume data.
    (Full implementation is in the previous version of app.py — preserved here)
    """
    try:
        data = request.get_json()
        resume_text      = data.get("resume_text", "")
        job_description  = data.get("job_description", "")
        missing_keywords = data.get("missing_keywords", "")
        suggestions      = data.get("suggestions", "")

        if not resume_text:
            return jsonify({"error": "resume_text is required"}), 400

        if USE_OPENAI:
            result = _generate_improved_resume_gpt(resume_text, job_description, missing_keywords, suggestions)
        else:
            result = _generate_improved_resume_rule_based(resume_text, job_description, missing_keywords, suggestions)

        return jsonify(result)
    except Exception as e:
        print(f"Error in /generate-improved-resume: {e}")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════
#  TRAIN STATUS ENDPOINT
#  Lets the Java backend (and admin UI) check if RF model is loaded
# ═══════════════════════════════════════════════════════════════

@app.route("/train-status", methods=["GET"])
def train_status():
    """Check training status and model metadata."""
    from pathlib import Path
    meta_path = Path(__file__).parent / "models" / "model_meta.json"
    meta = {}
    if meta_path.exists():
        try:
            with open(meta_path) as f:
                meta = json.load(f)
        except Exception:
            pass

    return jsonify({
        "rf_model_loaded":   RF_LOADED,
        "spacy_loaded":      SPACY_LOADED,
        "openai_enabled":    USE_OPENAI,
        "scoring_method":    "RF+TF-IDF" if RF_LOADED else "TF-IDF",
        "model_meta":        meta,
    })


# ═══════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

@app.route("/compare-roles", methods=["POST"])
def compare_roles():
    """
    What-If + Multi-Role Comparison.

    Request JSON:
    {
        "resume_text": "...",
        "roles": ["Frontend Developer", "Java Developer", "Data Analyst"]
                  (optional — defaults to all roles)
    }

    Response JSON:
    {
        "results": [ { role, atsScore, semanticScore, matchedSkills,
                        missingSkills, roleTip, semanticFit }, ... ],
        "bestFitRole": "...",
        "bestFitScore": 82.5,
        "worstFitRole": "...",
        "worstFitScore": 41.0,
        "recommendation": "..."
    }
    """
    try:
        data        = request.get_json()
        resume_text = data.get("resume_text", "")
        roles_req   = data.get("roles", list(ROLE_TEMPLATES.keys()))

        if not resume_text:
            return jsonify({"error": "resume_text is required"}), 400

        results = []
        for role_name in roles_req:
            if role_name not in ROLE_TEMPLATES:
                continue
            result = run_role_analysis(resume_text, role_name)
            results.append(result)

        if not results:
            return jsonify({"error": "No valid roles provided"}), 400

        # Sort by ATS score
        results.sort(key=lambda r: r["atsScore"], reverse=True)

        best   = results[0]
        worst  = results[-1]

        # Natural language recommendation
        gap    = round(best["atsScore"] - worst["atsScore"], 1)
        recommendation = (
            f"Your resume is strongest for {best['role']} "
            f"({best['atsScore']}% ATS score). "
            f"It is weakest for {worst['role']} ({worst['atsScore']}%). "
            f"The {gap}% gap suggests your current skill set is "
            f"{'highly targeted' if gap > 20 else 'broadly applicable but not specialised'}."
        )

        return jsonify({
            "results":       results,
            "bestFitRole":   best["role"],
            "bestFitScore":  best["atsScore"],
            "worstFitRole":  worst["role"],
            "worstFitScore": worst["atsScore"],
            "recommendation": recommendation,
        })

    except Exception as e:
        print(f"Error in /compare-roles: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/role-templates", methods=["GET"])
def get_role_templates():
    """Return available role template names and their JDs."""
    return jsonify({
        name: {
            "jd":       tpl["jd"][:200] + "...",
            "required": tpl["required"],
            "preferred": tpl["preferred"],
            "role_tip": tpl["role_tip"],
        }
        for name, tpl in ROLE_TEMPLATES.items()
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":          "running",
        "spacy_loaded":    SPACY_LOADED,
        "openai_enabled":  USE_OPENAI,
        "rf_loaded":       RF_LOADED,
        "scoring_method":  "RF+TF-IDF" if RF_LOADED else "TF-IDF",
        "message":         "AI Resume Analyzer ML Service is running!",
        "endpoints": [
            "POST /analyze",
            "POST /generate-improved-resume",
            "GET  /train-status",
            "GET  /health",
        ]
    })


# ═══════════════════════════════════════════════════════════════
#  CORE ML FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def calculate_match_score(resume_text: str, job_description: str) -> float:
    """TF-IDF cosine similarity. Preprocesses text before scoring."""
    try:
        # Use consistent preprocessing (expands abbreviations)
        clean_resume = preprocess_text(resume_text)
        clean_jd     = preprocess_text(job_description)

        vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            max_features=1000,
        )
        tfidf_matrix  = vectorizer.fit_transform([clean_resume, clean_jd])
        similarity    = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]
        score         = min(100.0, similarity * 200)
        return round(score, 2)

    except Exception as e:
        print(f"TF-IDF error: {e}")
        return 50.0


# ── Noise words that must NEVER appear as "missing skills" ─────────────────
# These are JD structural words, generic verbs, adjectives, and filler phrases
# that the old capitalized-word regex was incorrectly treating as skills.
KEYWORD_NOISE = {
    # JD section headers & meta-words
    "responsibilities", "qualifications", "requirements", "required", "preferred",
    "skills", "tools", "technologies", "experience", "knowledge", "understanding",
    "familiarity", "proficiency", "ability", "background", "expertise",
    "education", "degree", "bachelor", "master", "internship", "entry",
    "level", "junior", "senior", "full", "type", "key", "good", "basic",
    "strong", "preferred", "tools & technologies", "job", "role",
    # Generic action verbs (appear in JD bullets, not actual skills)
    "analyze", "develop", "maintain", "gather", "write", "build", "work",
    "create", "support", "manage", "design", "implement", "collaborate",
    "communicate", "present", "understand", "learn", "use", "apply",
    "identify", "ensure", "provide", "prepare", "assist", "perform",
    # Common adjectives / descriptors
    "critical", "statistical", "technical", "analytical", "excellent",
    "effective", "efficient", "relevant", "various", "multiple",
    # Single letters and common words that slip through
    "go", "r", "c", "a", "an", "the", "in", "for", "with", "and", "or",
    "to", "of", "is", "be", "as", "at", "by", "on", "it", "if",
    # Microsoft Office / Google non-specific terms
    "sheets", "excel", "google", "microsoft",
    # Generic tool category names (too broad to be useful)
    "tools & technologies excel / google sheets",
}

# ── Skills that need EXACT / meaningful context to count ────────────────────
# These words exist in TECH_SKILLS but are so generic that a JD mentioning
# them as concepts (not as tools) shouldn't count them as required skills.
CONTEXT_REQUIRED_SKILLS = {
    "statistics", "data science", "computer science",
}


def extract_keywords(text: str) -> set:
    """
    Extract ONLY genuine technical skills and tools from text.

    Strategy:
    1. TECH_SKILLS dictionary — exact multi-word skill matching (highest quality)
    2. spaCy NER — PRODUCT entities only (catches tool names like TensorFlow,
       Power BI, Tableau that aren't in the dictionary)
    3. Known tech abbreviations — hand-curated short-form tech terms
    The old "any capitalized word" fallback is REMOVED — it was the main
    source of noise (section headers, verbs, adjectives all start sentences).
    """
    keywords = set()
    text_lower = text.lower()

    # ── 1. TECH_SKILLS dictionary (most reliable) ──────────────
    for skill in TECH_SKILLS:
        # For context-sensitive skills, require them near tech keywords
        if skill in CONTEXT_REQUIRED_SKILLS:
            # Only count if surrounded by other tech context
            skill_idx = text_lower.find(skill)
            if skill_idx != -1:
                context = text_lower[max(0, skill_idx-80):skill_idx+80]
                tech_context = ["algorithm", "model", "analysis", "python",
                                "machine", "learning", "data", "engineer",
                                "analyst", "programming", "library", "framework"]
                if any(tc in context for tc in tech_context):
                    keywords.add(skill)
        else:
            if skill in text_lower:
                keywords.add(skill)

    # ── 2. spaCy PRODUCT entities only (tool/software names) ───
    # Use PRODUCT only — not ORG (catches company names) or GPE (cities)
    if SPACY_LOADED:
        doc = nlp(text[:50000])
        for ent in doc.ents:
            if ent.label_ == "PRODUCT":
                word = ent.text.lower().strip()
                # Must be 2+ chars, not in noise list, not a stopword
                if (len(word) >= 2
                        and word not in KEYWORD_NOISE
                        and not word.isdigit()
                        and word in TECH_SKILLS):
                    keywords.add(word)

    # ── 3. Known tech abbreviations (short forms regex misses) ──
    TECH_ABBREVIATIONS = {
        "ml", "ai", "nlp", "cv", "dl", "sql", "api", "sdk", "ide",
        "oop", "mvc", "orm", "jwt", "aws", "gcp", "css", "html",
        "vcs", "etl", "bi", "rpa", "eda", "llm",
    }
    words_in_text = set(re.findall(r'\b[a-z0-9+#./]{2,}\b', text_lower))
    for abbr in TECH_ABBREVIATIONS:
        if abbr in words_in_text:
            keywords.add(abbr)

    # ── 4. Remove noise words from final set ────────────────────
    keywords -= KEYWORD_NOISE
    # Also remove any single-character tokens and pure numbers
    keywords = {k for k in keywords if len(k) >= 2 and not k.isdigit()}

    return keywords


def generate_feedback(resume_text, job_description, score, matched, missing):
    if USE_OPENAI:
        return _gpt_feedback(resume_text, job_description, score, matched, missing)
    return _rule_based_feedback(score, matched, missing)


def _gpt_feedback(resume_text, job_description, score, matched, missing):
    try:
        prompt = f"""You are an expert resume reviewer.
Match Score: {score}%
Matched Skills: {', '.join(list(matched)[:10])}
Missing Skills: {', '.join(list(missing)[:10])}
Resume (2000 chars): {resume_text[:2000]}
Job Description (1000 chars): {job_description[:1000]}

Respond in this EXACT JSON format:
{{"feedback": "- Point 1\\n- Point 2\\n- Point 3", "suggestions": "1. Suggestion 1\\n2. Suggestion 2"}}"""

        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600, temperature=0.7,
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("feedback", ""), result.get("suggestions", "")
    except Exception as e:
        print(f"GPT error: {e}")
        return _rule_based_feedback(score, matched, missing)


def _rule_based_feedback(score, matched, missing):
    feedback_points = []
    suggestions = []

    if score >= 80:
        feedback_points.extend([
            "✅ Excellent match! Your resume aligns very well with the job requirements",
            "✅ Strong keyword coverage — most required skills are present",
        ])
    elif score >= 60:
        feedback_points.extend([
            "⚡ Good match with the job description — you meet most requirements",
            "⚡ Several important keywords are present in your resume",
        ])
    elif score >= 40:
        feedback_points.extend([
            "⚠️ Fair match — your resume partially aligns with the requirements",
            "⚠️ There are significant gaps in the required skills coverage",
        ])
    else:
        feedback_points.extend([
            "❌ Low match — your resume needs significant improvements for this role",
            "❌ Many required keywords and skills are missing from your resume",
        ])

    if matched:
        feedback_points.append(f"✅ Strong skills detected: {', '.join(list(matched)[:5])}")
    if missing:
        feedback_points.append(f"⚠️ Missing important keywords: {', '.join(list(missing)[:5])}")
    feedback_points.append("💡 Tailor your resume specifically to each job description for better results")

    if missing:
        suggestions.append(f"1. Add missing skills to your resume: {', '.join(list(missing)[:3])}")
    else:
        suggestions.append("1. Your skill coverage is strong — quantify your achievements more")

    suggestions.extend([
        "2. Add measurable achievements (e.g., 'Improved performance by 40%')",
        "3. Use bullet points starting with strong action verbs (Led, Built, Designed, Optimized)",
        "4. Add a professional summary at the top targeting this specific role",
        "5. Ensure your contact information and LinkedIn profile are up to date",
    ])

    return "\n".join(feedback_points), "\n".join(suggestions)


def generate_summary(resume_text: str) -> str:
    """
    Generate a structured, informative professional summary without requiring OpenAI.

    Extracts real signals from the resume text:
      - Candidate name (first meaningful line)
      - Likely role target (from job titles / objective lines)
      - Years of experience (from date patterns)
      - Top skills (up to 5)
      - Education level
      - Project count
      - Internship / open-source signals

    Composes a paragraph a recruiter can actually use.
    """
    if USE_OPENAI:
        try:
            prompt = (
                "You are an expert technical recruiter. Read this resume and write a "
                "structured 3-4 sentence professional summary that covers: "
                "(1) the candidate's role and experience level, "
                "(2) their top 3-5 technical skills, "
                "(3) notable projects or achievements, "
                "(4) education background. "
                "Be specific — use actual details from the resume, not generic phrases.\n\n"
                f"Resume:\n{resume_text[:3000]}"
            )
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=250,
                temperature=0.4,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"GPT summary error: {e}")

    # ── Rule-based structured summary (no OpenAI needed) ─────────
    resume_lower = resume_text.lower()
    lines        = [l.strip() for l in resume_text.split("\n") if l.strip()]

    # 1. Candidate name — first short line that isn't an email/URL
    name = "The candidate"
    for line in lines[:6]:
        if (3 <= len(line.split()) <= 5
                and "@" not in line
                and "http" not in line.lower()
                and not re.search(r"\d{5,}", line)):
            name = line.strip()
            break

    # 2. Role target — look for objective, summary, or common title patterns
    role = ""
    role_patterns = [
        r"(?:objective|summary|profile)[:\s]+([^\n]{10,80})",
        r"(?:seeking|aspiring|experienced|skilled)[\s]+([^\n]{10,60})",
    ]
    for pat in role_patterns:
        m = re.search(pat, resume_lower)
        if m:
            role = m.group(1).strip().capitalize()
            break

    # If no explicit objective, infer from JD-style title words in the resume
    if not role:
        title_words = [
            "software engineer", "data scientist", "frontend developer",
            "backend developer", "full stack developer", "data analyst",
            "machine learning engineer", "devops engineer", "product manager",
            "android developer", "ios developer", "cloud engineer",
            "java developer", "python developer", "web developer",
        ]
        for tw in title_words:
            if tw in resume_lower:
                role = tw.title()
                break

    # 3. Years of experience from date ranges
    years = re.findall(r"\b(20\d{2}|19\d{2})\b", resume_text)
    exp_years = 0
    if len(years) >= 2:
        try:
            exp_years = max(int(y) for y in years) - min(int(y) for y in years)
        except ValueError:
            pass

    # 4. Top skills (up to 5 most specific)
    skills_found = sorted(
        [s for s in TECH_SKILLS if s in resume_lower],
        key=lambda s: -len(s)          # prefer multi-word skills first
    )[:5]

    # 5. Education level
    edu_level = ""
    if any(k in resume_lower for k in ["ph.d", "phd", "doctorate"]):
        edu_level = "PhD"
    elif any(k in resume_lower for k in ["master", "m.tech", "m.e.", "mba", "m.sc"]):
        edu_level = "Master's degree"
    elif any(k in resume_lower for k in ["bachelor", "b.tech", "b.e.", "b.sc", "b.com", "undergraduate"]):
        edu_level = "Bachelor's degree"
    elif any(k in resume_lower for k in ["diploma", "polytechnic"]):
        edu_level = "Diploma"

    # 6. Project count
    project_verbs = ["built", "developed", "created", "implemented", "designed",
                     "deployed", "architected", "engineered", "launched"]
    project_hits  = sum(1 for v in project_verbs if v in resume_lower)
    # Count lines that look like project titles (short, title-case, near a verb)
    project_count_est = max(
        project_hits // 2,
        len(re.findall(r"(?:project|application|system|platform|app|tool)\b", resume_lower, re.IGNORECASE))
    )

    # 7. Special signals
    has_internship   = any(k in resume_lower for k in ["intern", "internship"])
    has_github       = "github" in resume_lower
    has_open_source  = any(k in resume_lower for k in ["open source", "open-source", "contribution"])
    has_certification = any(k in resume_lower for k in ["certified", "certification", "aws certified",
                                                        "google certified", "azure certified", "coursera",
                                                        "udemy", "nptel"])

    # ── Compose the summary ───────────────────────────────────────
    parts = []

    # Sentence 1: identity + experience
    if role and exp_years > 0:
        parts.append(
            f"{name} is a {role} with approximately {exp_years}+ year{'s' if exp_years != 1 else ''} "
            f"of hands-on experience."
        )
    elif role:
        exp_str = "fresher-level" if exp_years == 0 else f"{exp_years}+ years of"
        parts.append(f"{name} is a {role} with {exp_str} experience.")
    else:
        parts.append(f"{name} is a technology professional with a strong technical background.")

    # Sentence 2: skills
    if skills_found:
        skills_str = ", ".join(s.title() for s in skills_found[:4])
        parts.append(f"Core technical skills include {skills_str}.")
    else:
        parts.append("Demonstrates broad technical competency across multiple domains.")

    # Sentence 3: projects / practical work
    if project_count_est >= 3:
        proj_str = f"Has worked on {project_count_est}+ projects"
    elif project_count_est >= 1:
        proj_str = "Has demonstrated practical project experience"
    else:
        proj_str = "Resume shows some practical work experience"

    extras = []
    if has_internship:     extras.append("internship experience")
    if has_open_source:    extras.append("open-source contributions")
    if has_github:         extras.append("active GitHub profile")
    if has_certification:  extras.append("relevant certifications")

    if extras:
        parts.append(f"{proj_str}, including {', '.join(extras[:2])}.")
    else:
        parts.append(f"{proj_str}.")

    # Sentence 4: education
    if edu_level:
        parts.append(f"Holds a {edu_level} in a relevant field.")

    return " ".join(parts)


# ── Improved resume helpers (rule-based fallback) ────────────

def _generate_improved_resume_gpt(resume_text, job_description, missing_keywords, suggestions):
    missing_list = [k.strip() for k in missing_keywords.split(",") if k.strip()]
    prompt = f"""You are an expert resume writer. Rewrite this resume to be ATS-friendly and tailored for the job.
Resume: {resume_text[:3000]}
Job Description: {job_description[:1500]}
Missing Keywords to add: {', '.join(missing_list)}
Suggestions: {suggestions[:800]}

Respond ONLY with valid JSON (no markdown):
{{"candidateName":"...","professionalSummary":"...","skills":["..."],"experience":[{{"title":"...","company":"...","period":"...","bullets":["..."]}}],"education":[{{"degree":"...","institution":"...","year":"..."}}],"improvements":["..."]}}"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000, temperature=0.6,
        )
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", response.choices[0].message.content.strip())
        return json.loads(content)
    except Exception as e:
        print(f"GPT improved resume error: {e}")
        return _generate_improved_resume_rule_based(resume_text, job_description, missing_keywords, suggestions)


def _generate_improved_resume_rule_based(resume_text, job_description, missing_keywords, suggestions):
    lines = [l.strip() for l in resume_text.split("\n") if l.strip()]
    candidate_name = lines[0] if lines and "@" not in lines[0] else "Candidate"
    skills = list(extract_keywords(resume_text))
    missing_list = [k.strip() for k in missing_keywords.split(",") if k.strip()]
    all_skills = list(dict.fromkeys(skills + missing_list))[:20]
    top_skills = ", ".join(all_skills[:5]) or "diverse technical skills"
    return {
        "candidateName": candidate_name,
        "professionalSummary": f"Results-driven professional with expertise in {top_skills}. "
                               f"Proven track record of delivering impactful solutions.",
        "skills": [s.title() for s in all_skills],
        "experience": [{"title": "Professional Role", "company": "Company", "period": "Year–Present",
                        "bullets": ["Led key initiatives to improve operational efficiency",
                                    "Collaborated cross-functionally to deliver projects on schedule"]}],
        "education": [],
        "improvements": [
            f"Integrated missing keywords: {', '.join(missing_list[:5])}",
            "Rewrote experience bullets with strong action verbs",
            "Added professional summary targeting the job description",
        ],
    }


if __name__ == "__main__":
    print("\n" + "="*55)
    print("🚀 AI Resume Analyzer ML Service Starting...")
    print(f"   spaCy NER:      {'✅ Loaded' if SPACY_LOADED else '❌ Not loaded'}")
    print(f"   OpenAI GPT:     {'✅ Enabled' if USE_OPENAI else '⚠️  Disabled'}")
    print(f"   Random Forest:  {'✅ Loaded' if RF_LOADED else '⚠️  Not trained (run train_model.py)'}")
    print(f"   Scoring Method: {'RF + TF-IDF' if RF_LOADED else 'TF-IDF only'}")
    print(f"   Listening on:   http://localhost:5000")
    print("="*55 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)