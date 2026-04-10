package com.resumeai.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "resume_analysis")
public class ResumeAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id", nullable = false)
    private Resume resume;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analyzed_by")
    private User analyzedBy;

    @Column(name = "job_description", columnDefinition = "LONGTEXT")
    private String jobDescription;

    // ── Scores ────────────────────────────────────────────────────
    @Column(name = "match_score")
    private Double matchScore;

    /**
     * Skill match sub-score (0-100).
     * Percentage of JD-required skills found in the resume.
     * Added for multi-dimensional scoring.
     */
    @Column(name = "skill_score")
    private Double skillScore;

    /**
     * Experience relevance sub-score (0-100).
     * Heuristic based on date patterns, experience section presence,
     * and JD experience-level alignment.
     */
    @Column(name = "experience_score")
    private Double experienceScore;

    /**
     * Project relevance sub-score (0-100).
     * Based on project section depth, action verbs, impact language,
     * and tech-stack overlap in project context.
     */
    @Column(name = "project_score")
    private Double projectScore;

    /**
     * Resume quality / ATS-friendliness sub-score (0-100).
     * Checks key sections, length, action verb density, quantified
     * achievements; penalises keyword stuffing.
     */
    @Column(name = "resume_quality_score")
    private Double resumeQualityScore;

    // ── Text fields (unchanged) ───────────────────────────────────
    @Column(name = "keywords_matched", columnDefinition = "TEXT")
    private String keywordsMatched;

    @Column(name = "missing_keywords", columnDefinition = "TEXT")
    private String missingKeywords;

    @Column(name = "feedback_points", columnDefinition = "LONGTEXT")
    private String feedbackPoints;

    @Column(name = "improvement_suggestions", columnDefinition = "LONGTEXT")
    private String improvementSuggestions;

    @Column(name = "summary", columnDefinition = "LONGTEXT")
    private String summary;

    // ── Decision + timestamp (unchanged) ──────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "decision")
    private Decision decision = Decision.PENDING;

    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    @PrePersist
    protected void onCreate() {
        this.analyzedAt = LocalDateTime.now();
    }

    public enum Decision {
        PENDING,
        ACCEPTED,
        REJECTED
    }

    // ── Getters / Setters ─────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Resume getResume() { return resume; }
    public void setResume(Resume resume) { this.resume = resume; }

    public User getAnalyzedBy() { return analyzedBy; }
    public void setAnalyzedBy(User analyzedBy) { this.analyzedBy = analyzedBy; }

    public String getJobDescription() { return jobDescription; }
    public void setJobDescription(String jobDescription) { this.jobDescription = jobDescription; }

    public Double getMatchScore() { return matchScore; }
    public void setMatchScore(Double matchScore) { this.matchScore = matchScore; }

    public Double getSkillScore() { return skillScore; }
    public void setSkillScore(Double skillScore) { this.skillScore = skillScore; }

    public Double getExperienceScore() { return experienceScore; }
    public void setExperienceScore(Double experienceScore) { this.experienceScore = experienceScore; }

    public Double getProjectScore() { return projectScore; }
    public void setProjectScore(Double projectScore) { this.projectScore = projectScore; }

    public Double getResumeQualityScore() { return resumeQualityScore; }
    public void setResumeQualityScore(Double resumeQualityScore) { this.resumeQualityScore = resumeQualityScore; }

    public String getKeywordsMatched() { return keywordsMatched; }
    public void setKeywordsMatched(String keywordsMatched) { this.keywordsMatched = keywordsMatched; }

    public String getMissingKeywords() { return missingKeywords; }
    public void setMissingKeywords(String missingKeywords) { this.missingKeywords = missingKeywords; }

    public String getFeedbackPoints() { return feedbackPoints; }
    public void setFeedbackPoints(String feedbackPoints) { this.feedbackPoints = feedbackPoints; }

    public String getImprovementSuggestions() { return improvementSuggestions; }
    public void setImprovementSuggestions(String improvementSuggestions) { this.improvementSuggestions = improvementSuggestions; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public Decision getDecision() { return decision; }
    public void setDecision(Decision decision) { this.decision = decision; }

    public LocalDateTime getAnalyzedAt() { return analyzedAt; }
    public void setAnalyzedAt(LocalDateTime analyzedAt) { this.analyzedAt = analyzedAt; }
}
