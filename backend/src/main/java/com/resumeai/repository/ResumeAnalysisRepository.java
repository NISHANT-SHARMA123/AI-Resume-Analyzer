package com.resumeai.repository;

import com.resumeai.model.ResumeAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * ResumeAnalysisRepository
 *
 * Spring Data JPA — method names generate SQL automatically.
 *
 * EXISTING:
 *   findByResumeId(...)
 *   findByAnalyzedByIdOrderByMatchScoreDesc(...)
 *   findTopCandidates(...)
 *
 * NEW:
 *   findByAnalyzedByIdOrderByAnalyzedAtDesc(...)   — history, newest first
 *   findByAnalyzedByIdAndDecisionOrderByMatchScoreDesc(...)  — accepted list
 *   findByResumeIdInOrderByAnalyzedAtDesc(...)     — candidate portal history
 */
@Repository
public interface ResumeAnalysisRepository extends JpaRepository<ResumeAnalysis, Long> {

    // All analyses for a specific resume
    List<ResumeAnalysis> findByResumeId(Long resumeId);

    // All analyses by an interviewer, best score first (existing)
    List<ResumeAnalysis> findByAnalyzedByIdOrderByMatchScoreDesc(Long userId);

    // All analyses by an interviewer, newest first — History tab
    List<ResumeAnalysis> findByAnalyzedByIdOrderByAnalyzedAtDesc(Long interviewerId);

    // All ACCEPTED analyses by an interviewer, best score first — Accepted panel
    List<ResumeAnalysis> findByAnalyzedByIdAndDecisionOrderByMatchScoreDesc(
            Long interviewerId,
            ResumeAnalysis.Decision decision
    );

    // Top candidates above a score threshold (existing)
    @Query("SELECT ra FROM ResumeAnalysis ra WHERE ra.matchScore >= :minScore ORDER BY ra.matchScore DESC")
    List<ResumeAnalysis> findTopCandidates(double minScore);

    // Used by candidate history panel
    List<ResumeAnalysis> findByResumeIdInOrderByAnalyzedAtDesc(List<Long> resumeIds);
}
