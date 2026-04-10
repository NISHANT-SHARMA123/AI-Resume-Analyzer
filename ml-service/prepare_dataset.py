# ml-service/prepare_dataset.py
# Converts Resume.csv into training format for train_model.py

import pandas as pd
import random

print("Loading Resume.csv...")
df = pd.read_csv("Resume.csv")

print(f"Total resumes: {len(df)}")
print(f"Categories found: {df['Category'].unique()}")
print(f"Resumes per category:\n{df['Category'].value_counts()}\n")

# Use Resume_str (plain text) column
df = df[['Resume_str', 'Category']].dropna()
df.columns = ['resume_text', 'category']
df['resume_text'] = df['resume_text'].astype(str)

records = []
categories = df['category'].unique()

for cat in categories:
    same_cat = df[df['category'] == cat]['resume_text'].tolist()
    diff_cat = df[df['category'] != cat]['resume_text'].tolist()

    # Use the first resume of each category as job description proxy
    jd_proxy = same_cat[0] if same_cat else ""

    # Positive pairs: same category resume vs jd_proxy → label 1 (relevant)
    for resume in same_cat[1:]:
        records.append({
            'resume_text':     resume,
            'job_description': jd_proxy,
            'label':           1
        })

    # Negative pairs: different category resume vs jd_proxy → label 0 (not relevant)
    random.shuffle(diff_cat)
    for resume in diff_cat[:len(same_cat)]:
        records.append({
            'resume_text':     resume,
            'job_description': jd_proxy,
            'label':           0
        })

out = pd.DataFrame(records)
out.to_csv("resumes_labeled.csv", index=False)

print(f"✅ Done! Saved {len(out)} labeled rows to resumes_labeled.csv")
print(f"   Relevant (label=1):   {out['label'].sum()}")
print(f"   Irrelevant (label=0): {(out['label']==0).sum()}")