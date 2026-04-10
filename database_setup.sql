-- ═══════════════════════════════════════════════════════════════
--  ResumeAI — MySQL Database Setup Script
--  Run this script to create all tables from scratch.
--
--  HOW TO RUN:
--    Option 1 (Terminal):
--      mysql -u root -p < database_setup.sql
--
--    Option 2 (MySQL Workbench):
--      Open MySQL Workbench → File → Run SQL Script → select this file
--
--    Option 3 (Spring Boot auto-creates tables):
--      If spring.jpa.hibernate.ddl-auto=update in application.properties,
--      Spring Boot creates tables automatically on first run.
-- ═══════════════════════════════════════════════════════════════

-- Create the database (if not already created by Spring Boot)
CREATE DATABASE IF NOT EXISTS resumeai_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE resumeai_db;

-- ────────────────────────────────────────────────────────────
--  TABLE: users
--  Stores both Candidates and Interviewers
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)         NOT NULL,
    email       VARCHAR(255)         NOT NULL UNIQUE,
    password    VARCHAR(255)         NOT NULL,   -- BCrypt hash
    role        ENUM('CANDIDATE', 'INTERVIEWER') NOT NULL DEFAULT 'CANDIDATE',
    created_at  DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Index on email for fast login lookups
    INDEX idx_users_email (email),
    INDEX idx_users_role  (role)
);

-- ────────────────────────────────────────────────────────────
--  TABLE: resumes
--  Stores uploaded resume file metadata and extracted text
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    file_name       VARCHAR(500)    NOT NULL,       -- Original filename
    file_path       VARCHAR(1000)   NOT NULL,       -- Path on disk
    file_type       VARCHAR(10)     DEFAULT 'PDF',  -- PDF or DOCX
    file_size       BIGINT          DEFAULT 0,      -- Size in bytes
    extracted_text  LONGTEXT,                       -- Full plain text of resume
    uploaded_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key: resume belongs to a user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_resumes_user (user_id)
);

-- ────────────────────────────────────────────────────────────
--  TABLE: resume_analysis
--  Stores ML analysis results for each resume-JD comparison
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_analysis (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    resume_id               BIGINT          NOT NULL,
    analyzed_by             BIGINT,                     -- Interviewer or candidate user ID
    job_description         LONGTEXT,                   -- The JD used for comparison
    match_score             DOUBLE          DEFAULT 0,  -- 0.0 to 100.0
    keywords_matched        TEXT,                       -- Comma-separated matched keywords
    missing_keywords        TEXT,                       -- Comma-separated missing keywords
    feedback_points         LONGTEXT,                   -- Newline-separated feedback
    improvement_suggestions LONGTEXT,                   -- Newline-separated suggestions
    summary                 LONGTEXT,                   -- Paragraph summary of resume
    decision                ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING',
    analyzed_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (resume_id)   REFERENCES resumes(id) ON DELETE CASCADE,
    FOREIGN KEY (analyzed_by) REFERENCES users(id)   ON DELETE SET NULL,

    INDEX idx_analysis_resume  (resume_id),
    INDEX idx_analysis_score   (match_score DESC),
    INDEX idx_analysis_decision(decision)
);

-- ────────────────────────────────────────────────────────────
--  SEED DATA — Optional test users for development
--  Password for both: "password123"  (BCrypt hashed below)
-- ────────────────────────────────────────────────────────────
INSERT IGNORE INTO users (name, email, password, role) VALUES
  ('Alice Candidate',   'candidate@test.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CANDIDATE'),
  ('Bob Interviewer',   'interviewer@test.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'INTERVIEWER');

-- ────────────────────────────────────────────────────────────
--  USEFUL QUERIES FOR DEVELOPMENT
-- ────────────────────────────────────────────────────────────

-- View all users:
-- SELECT id, name, email, role, created_at FROM users;

-- View all resumes:
-- SELECT r.id, u.name, r.file_name, r.file_type, r.uploaded_at
-- FROM resumes r JOIN users u ON r.user_id = u.id;

-- View top candidates by score:
-- SELECT ra.id, r.file_name, ra.match_score, ra.decision, ra.analyzed_at
-- FROM resume_analysis ra
-- JOIN resumes r ON ra.resume_id = r.id
-- ORDER BY ra.match_score DESC;

-- View only accepted candidates:
-- SELECT ra.id, r.file_name, ra.match_score, ra.keywords_matched
-- FROM resume_analysis ra
-- JOIN resumes r ON ra.resume_id = r.id
-- WHERE ra.decision = 'ACCEPTED'
-- ORDER BY ra.match_score DESC;
