package com.resumeai.controller;

import com.resumeai.service.InterviewerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * InterviewerController — REST endpoints for recruiter operations
 *
 * BASE URL: /api/interviewer
 *
 * EXISTING ENDPOINTS:
 *   POST /bulk-upload              → Analyze multiple resumes, rank by score
 *   PUT  /decision/{analysisId}    → Accept or reject a candidate
 *
 * NEW ENDPOINTS:
 *   GET  /summary/{analysisId}     → Fetch full AI summary for one candidate
 *   GET  /resume-file/{analysisId} → Download the original resume file
 *   GET  /history/{interviewerId}  → Paginated analysis history for interviewer
 *   GET  /accepted/{interviewerId} → List of all ACCEPTED candidates
 *   GET  /bulk-download/{interviewerId} → ZIP of all accepted resumes + reports
 */
@RestController
@RequestMapping("/api/interviewer")
public class InterviewerController {

    @Autowired private InterviewerService interviewerService;

    // ─────────────────────────────────────────────────────────
    //  EXISTING: Bulk Upload & Analyze
    // ─────────────────────────────────────────────────────────

    @PostMapping("/bulk-upload")
    public ResponseEntity<Map<String, Object>> bulkUpload(
            @RequestParam("files") MultipartFile[] files,
            @RequestParam("jobDescription") String jobDescription,
            @RequestParam("userId") Long userId) {
        try {
            return ResponseEntity.ok(interviewerService.bulkAnalyze(files, jobDescription, userId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Bulk upload failed: " + e.getMessage()
            ));
        }
    }

    // ─────────────────────────────────────────────────────────
    //  EXISTING: Accept / Reject Decision
    // ─────────────────────────────────────────────────────────

    @PutMapping("/decision/{analysisId}")
    public ResponseEntity<Map<String, Object>> updateDecision(
            @PathVariable Long analysisId,
            @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(interviewerService.updateDecision(analysisId, body.get("decision")));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to update decision: " + e.getMessage()
            ));
        }
    }

    // ─────────────────────────────────────────────────────────
    //  NEW: View Full AI Summary for a Candidate
    //
    //  GET /api/interviewer/summary/{analysisId}
    //
    //  Returns the complete structured summary for one analysis:
    //  skills, experience, education, keyword coverage, suitability.
    //  The summary text was already stored during bulk-upload —
    //  this endpoint fetches and structures it for the modal panel.
    // ─────────────────────────────────────────────────────────
    @GetMapping("/summary/{analysisId}")
    public ResponseEntity<Map<String, Object>> getCandidateSummary(
            @PathVariable Long analysisId) {
        try {
            return ResponseEntity.ok(interviewerService.getCandidateSummary(analysisId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to fetch summary: " + e.getMessage()
            ));
        }
    }

    // ─────────────────────────────────────────────────────────
    //  NEW: Download Original Resume File
    //
    //  GET /api/interviewer/resume-file/{analysisId}
    //
    //  Looks up the resume by analysisId, reads the file from
    //  disk (stored path in DB), and streams it as a download.
    //  Uses the original filename in Content-Disposition.
    // ─────────────────────────────────────────────────────────
    @GetMapping("/resume-file/{analysisId}")
    public ResponseEntity<byte[]> downloadResumeFile(
            @PathVariable Long analysisId) {
        try {
            byte[] data     = interviewerService.getResumeFileBytes(analysisId);
            String fileName = interviewerService.getResumeFileName(analysisId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ─────────────────────────────────────────────────────────
    //  NEW: Analysis History for an Interviewer
    //
    //  GET /api/interviewer/history/{interviewerId}
    //
    //  Returns up to 50 most recent analyses performed by this
    //  interviewer, newest first. Includes all fields needed
    //  for the History tab: fileName, score, decision, date,
    //  summary, keywords, analysisId (for re-download).
    // ─────────────────────────────────────────────────────────
    @GetMapping("/history/{interviewerId}")
    public ResponseEntity<Object> getHistory(@PathVariable Long interviewerId) {
        try {
            return ResponseEntity.ok(interviewerService.getHistory(interviewerId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    // ─────────────────────────────────────────────────────────
    //  NEW: List All Accepted Candidates
    //
    //  GET /api/interviewer/accepted/{interviewerId}
    //
    //  Returns all analyses with decision = ACCEPTED for this
    //  interviewer. Used to populate the Accepted Candidates
    //  panel and drive the bulk download.
    // ─────────────────────────────────────────────────────────
    @GetMapping("/accepted/{interviewerId}")
    public ResponseEntity<Object> getAcceptedCandidates(
            @PathVariable Long interviewerId) {
        try {
            return ResponseEntity.ok(interviewerService.getAcceptedCandidates(interviewerId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    // ─────────────────────────────────────────────────────────
    //  NEW: Bulk Download — All Accepted Resumes as ZIP
    //
    //  GET /api/interviewer/bulk-download/{interviewerId}
    //
    //  Builds a ZIP archive containing:
    //    - Each accepted candidate's original resume file
    //    - A combined PDF report (scores + summaries for all)
    //    - A manifest.txt listing all candidates and scores
    //
    //  The ZIP is streamed directly to the browser without
    //  being saved to disk first (ByteArrayOutputStream).
    // ─────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────
    //  NEW: Clear All History for an Interviewer
    //
    //  DELETE /api/interviewer/history/{interviewerId}
    //
    //  Deletes all ResumeAnalysis records for this interviewer.
    //  Resume files on disk are NOT deleted.
    // ─────────────────────────────────────────────────────────
    @DeleteMapping("/history/{interviewerId}")
    public ResponseEntity<Object> clearHistory(@PathVariable Long interviewerId) {
        try {
            interviewerService.clearHistory(interviewerId);
            return ResponseEntity.ok(Map.of("success", true, "message", "History cleared successfully."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to clear history: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/bulk-download/{interviewerId}")
    public ResponseEntity<byte[]> bulkDownloadAccepted(
            @PathVariable Long interviewerId) {
        try {
            byte[] zipBytes = interviewerService.buildAcceptedCandidatesZip(interviewerId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"accepted_candidates.zip\"")
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .body(zipBytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
