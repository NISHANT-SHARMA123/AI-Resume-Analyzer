package com.resumeai.repository;

import com.resumeai.model.Resume;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * ResumeRepository
 *
 * Spring Data JPA repository for the resumes table.
 */
@Repository
public interface ResumeRepository extends JpaRepository<Resume, Long> {

    /**
     * Find all resumes uploaded by a specific user.
     * Used to load analysis history for the CandidatePortal.
     *
     * Spring auto-generates:
     *   SELECT * FROM resumes WHERE user_id = :userId
     */
    List<Resume> findByUserId(Long userId);
}
