# AI Resume Analyzer

An AI-powered resume analysis platform that supports both technical
and non-technical resumes.

## Features
- ATS Score with composite scoring (Keywords + Experience + Projects + Quality)
- Semantic matching using sentence-transformers
- Multi-role What-If simulator (18 roles across 7 domains)
- Blind screening mode
- Candidate comparison dashboard
- Before/After bullet point rewrites
- Weak phrase detection
- PDF report download
- Recruiter dashboard with analytics

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Spring Boot (Java 17) + MySQL
- **ML Service:** Python Flask + spaCy + scikit-learn + sentence-transformers

## How to Run

### ML Service
```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

### Backend
```bash
cd backend
mvn spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables
Copy `.env.example` and fill in your values.
