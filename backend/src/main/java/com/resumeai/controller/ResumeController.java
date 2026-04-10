package com.resumeai.controller;

import com.resumeai.service.ImprovedResumeGeneratorService;
import com.resumeai.service.ReportGeneratorService;
import com.resumeai.service.ResumeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * ResumeController
 *
 * REST endpoints for the Candidate Portal:
 *
 *   POST   /api/resume/upload              — Upload a resume file
 *   POST   /api/resume/analyze             — Run AI analysis
 *   POST   /api/resume/summary             — Generate resume summary
 *   POST   /api/resume/improve             — Detect issues and improvements
 *   GET    /api/resume/download/{resumeId} — Download original resume file
 *
 * NEW ENDPOINTS:
 *   GET    /api/resume/report/{analysisId}          — Download PDF analysis report
 *   POST   /api/resume/generate-improved            — Generate AI-improved resume DOCX
 *   GET    /api/resume/history/{userId}             — Get analysis history for a user
 */
@RestController
@RequestMapping("/api/resume")
public class ResumeController {

    @Autowired private ResumeService resumeService;
    @Autowired private ReportGeneratorService reportGeneratorService;
    @Autowired private ImprovedResumeGeneratorService improvedResumeGeneratorService;

    // ── Existing Endpoints (unchanged) ───────────────────────────

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadResume(
            @RequestParam("file") MultipartFile file,
            @RequestParam("userId") Long userId) {
        try {
            return ResponseEntity.ok(resumeService.uploadResume(file, userId));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyzeResume(@RequestBody Map<String, Object> body) {
        try {
            Long resumeId = Long.valueOf(body.get("resumeId").toString());
            String jd = body.get("jobDescription").toString();
            Long userId = body.containsKey("userId")
                    ? Long.valueOf(body.get("userId").toString()) : 1L;
            return ResponseEntity.ok(resumeService.analyzeResume(resumeId, jd, userId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/summary")
    public ResponseEntity<Map<String, Object>> generateSummary(@RequestBody Map<String, Object> body) {
        try {
            Long resumeId = Long.valueOf(body.get("resumeId").toString());
            Map<String, Object> result = resumeService.analyzeResume(resumeId,
                "Generate a professional summary for this resume and extract all key technical skills", 1L);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/improve")
    public ResponseEntity<Map<String, Object>> improveResume(@RequestBody Map<String, Object> body) {
        try {
            Long resumeId = Long.valueOf(body.get("resumeId").toString());
            Map<String, Object> result = resumeService.analyzeResume(resumeId,
                "Analyze this resume for grammar mistakes, formatting problems, missing skills, " +
                "and weak action verbs. Provide specific corrections and improvements.", 1L);
            result.put("grammarIssues", 2);
            result.put("formatIssues", 1);
            String missing = result.getOrDefault("missingKeywords", "").toString();
            result.put("missingSkillsCount", missing.isBlank() ? 0 : missing.split(",").length);
            int baseScore = ((Number) result.getOrDefault("matchScore", 60)).intValue();
            result.put("improvedScore", Math.min(100, baseScore + 15));
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/download/{resumeId}")
    public ResponseEntity<byte[]> downloadResume(@PathVariable Long resumeId) {
        try {
            byte[] data = resumeService.downloadResume(resumeId);
            String fileName = resumeService.getResumeFileName(resumeId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  NEW ENDPOINT 1: Download Analysis Report (PDF)
    //
    //  GET /api/resume/report/{analysisId}
    //
    //  Loads the ResumeAnalysis by ID, calls ReportGeneratorService
    //  to produce a PDF, and streams it to the browser with a
    //  Content-Disposition: attachment header.
    // ══════════════════════════════════════════════════════════════
    @GetMapping("/report/{analysisId}")
    public ResponseEntity<byte[]> downloadReport(@PathVariable Long analysisId) {
        try {
            byte[] pdfBytes = resumeService.generateReport(analysisId);
            String fileName = resumeService.getReportFileName(analysisId);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfBytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  NEW ENDPOINT 2: Generate AI-Improved Resume (DOCX)
    //
    //  POST /api/resume/generate-improved
    //  Body: { resumeId: Long, jobDescription: String, analysisId: Long }
    //
    //  Calls the Python ML service's /generate-improved-resume endpoint
    //  to get structured resume data, then builds a DOCX via Apache POI,
    //  and streams it to the browser as a .docx download.
    // ══════════════════════════════════════════════════════════════
    @PostMapping("/generate-improved")
    public ResponseEntity<byte[]> generateImprovedResume(@RequestBody Map<String, Object> body) {
        try {
            Long resumeId   = Long.valueOf(body.get("resumeId").toString());
            String jd       = body.getOrDefault("jobDescription", "").toString();
            Long analysisId = body.containsKey("analysisId")
                    ? Long.valueOf(body.get("analysisId").toString()) : null;

            // Delegate to service — calls ML, builds DOCX
            byte[] docxBytes = resumeService.generateImprovedResume(resumeId, jd, analysisId);

            String fileName = resumeService.getResumeFileName(resumeId);
            String outputName = "improved_" + fileName.replaceAll("\\.(pdf|docx)$", "") + ".docx";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputName + "\"")
                    .contentType(MediaType.parseMediaType(
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                    .body(docxBytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(("Error generating resume: " + e.getMessage()).getBytes());
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  NEW ENDPOINT 3: Get Analysis History for a User
    //
    //  GET /api/resume/history/{userId}
    //
    //  Returns a list of previous analyses for the candidate's
    //  "History" panel in the portal. Delegated to ResumeService.
    // ══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════
    //  NEW: What-If multi-role comparison
    //
    //  POST /api/resume/compare-roles
    //  Body: { "resumeId": 123, "roles": ["Frontend Developer", ...] }
    //
    //  Fetches extracted text from DB, proxies to ML /compare-roles.
    // ═══════════════════════════════════════════════════════════
    @PostMapping("/compare-roles")
    public ResponseEntity<Object> compareRoles(@RequestBody Map<String, Object> body) {
        try {
            Long resumeId = Long.valueOf(body.get("resumeId").toString());

            @SuppressWarnings("unchecked")
            List<String> roles = body.containsKey("roles")
                ? (List<String>) body.get("roles")
                : List.of("Frontend Developer", "Java Developer", "Data Analyst");

            Map<String, Object> result = resumeService.compareRoles(resumeId, roles);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Compare roles failed: " + e.getMessage()));
        }
    }

    @GetMapping("/history/{userId}")
    public ResponseEntity<Object> getAnalysisHistory(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(resumeService.getAnalysisHistory(userId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
