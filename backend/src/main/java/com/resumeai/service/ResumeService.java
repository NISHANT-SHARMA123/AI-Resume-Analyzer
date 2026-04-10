package com.resumeai.service;

import com.resumeai.model.Resume;
import com.resumeai.model.ResumeAnalysis;
import com.resumeai.model.User;
import com.resumeai.repository.ResumeAnalysisRepository;
import com.resumeai.repository.ResumeRepository;
import com.resumeai.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ResumeService — core business logic for resume upload and analysis
 *
 * UPLOAD FLOW:
 *   1. Receive file from controller
 *   2. Save file to disk (./uploads/ folder)
 *   3. Extract text using FileParserService
 *   4. Save Resume record to database
 *   5. Return resumeId to frontend
 *
 * ANALYZE FLOW:
 *   1. Load resume from database by resumeId
 *   2. Send resumeText + jobDescription to Python ML service
 *   3. Get back score, keywords, feedback
 *   4. Save ResumeAnalysis record to database
 *   5. Return results to frontend
 *
 * NEW FLOWS:
 *   generateReport()         → Calls ReportGeneratorService to produce PDF bytes
 *   generateImprovedResume() → Calls ML service then ImprovedResumeGeneratorService
 *   getAnalysisHistory()     → Returns paginated history for a user
 */
@Service
public class ResumeService {

    @Autowired private ResumeRepository resumeRepository;
    @Autowired private ResumeAnalysisRepository analysisRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private FileParserService fileParserService;
    @Autowired private MlService mlService;
    @Autowired private ReportGeneratorService reportGeneratorService;
    @Autowired private ImprovedResumeGeneratorService improvedResumeGeneratorService;

    @Value("${app.upload.dir}")
    private String uploadDir;

    // ══════════════════════════════════════════════════════════════
    //  EXISTING: uploadResume
    // ══════════════════════════════════════════════════════════════
    public Map<String, Object> uploadResume(MultipartFile file, Long userId) throws IOException {
        Map<String, Object> response = new HashMap<>();

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));

        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String uniqueId = UUID.randomUUID().toString().substring(0, 8);
        String originalName = file.getOriginalFilename();
        String savedFileName = uniqueId + "_" + originalName;
        Path filePath = uploadPath.resolve(savedFileName);

        Files.copy(file.getInputStream(), filePath);

        String extractedText = fileParserService.extractText(file);

        Resume resume = new Resume();
        resume.setUser(user);
        resume.setFileName(originalName);
        resume.setFilePath(filePath.toString());
        resume.setFileType(originalName.endsWith(".pdf") ? "PDF" : "DOCX");
        resume.setFileSize(file.getSize());
        resume.setExtractedText(extractedText);

        Resume saved = resumeRepository.save(resume);

        response.put("success", true);
        response.put("resumeId", saved.getId());
        response.put("fileName", saved.getFileName());
        response.put("message", "Resume uploaded and text extracted successfully!");
        return response;
    }

    // ══════════════════════════════════════════════════════════════
    //  EXISTING: analyzeResume
    // ══════════════════════════════════════════════════════════════
    public Map<String, Object> analyzeResume(Long resumeId, String jobDescription, Long analyzedByUserId) {
        Resume resume = resumeRepository.findById(resumeId)
            .orElseThrow(() -> new RuntimeException("Resume not found with id: " + resumeId));

        User analyzer = userRepository.findById(analyzedByUserId).orElse(null);

        Map<String, Object> mlResult = mlService.analyzeResume(resume.getExtractedText(), jobDescription);

        Double matchScore = mlResult.get("matchScore") instanceof Number
            ? ((Number) mlResult.get("matchScore")).doubleValue() : 0.0;

        ResumeAnalysis analysis = new ResumeAnalysis();
        analysis.setResume(resume);
        analysis.setAnalyzedBy(analyzer);
        analysis.setJobDescription(jobDescription);
        analysis.setMatchScore(matchScore);
        analysis.setKeywordsMatched(safeString(mlResult.get("keywordsMatched")));
        analysis.setMissingKeywords(safeString(mlResult.get("missingKeywords")));
        analysis.setFeedbackPoints(safeString(mlResult.get("feedbackPoints")));
        analysis.setImprovementSuggestions(safeString(mlResult.get("improvementSuggestions")));
        analysis.setSummary(safeString(mlResult.get("summary")));
        analysis.setDecision(ResumeAnalysis.Decision.PENDING);

        ResumeAnalysis saved = analysisRepository.save(analysis);

        Map<String, Object> response = new HashMap<>(mlResult);
        response.put("analysisId", saved.getId());
        response.put("matchScore", matchScore);
        return response;
    }

    // ══════════════════════════════════════════════════════════════
    //  EXISTING: downloadResume / getResumeFileName
    // ══════════════════════════════════════════════════════════════
    public byte[] downloadResume(Long resumeId) throws IOException {
        Resume resume = resumeRepository.findById(resumeId)
            .orElseThrow(() -> new RuntimeException("Resume not found"));
        return Files.readAllBytes(Paths.get(resume.getFilePath()));
    }

    public String getResumeFileName(Long resumeId) {
        return resumeRepository.findById(resumeId)
            .map(Resume::getFileName)
            .orElse("resume.pdf");
    }

    // ══════════════════════════════════════════════════════════════
    //  NEW: generateReport — Build a PDF analysis report
    //
    //  Loads the ResumeAnalysis from the DB by analysisId,
    //  passes it to ReportGeneratorService which returns PDF bytes.
    // ══════════════════════════════════════════════════════════════
    public byte[] generateReport(Long analysisId) throws Exception {
        ResumeAnalysis analysis = analysisRepository.findById(analysisId)
            .orElseThrow(() -> new RuntimeException("Analysis not found with id: " + analysisId));

        return reportGeneratorService.generateAnalysisReport(analysis);
    }

    /**
     * Build a descriptive file name for the downloaded report PDF.
     * e.g. "report_my_resume_2024-01-15.pdf"
     */
    public String getReportFileName(Long analysisId) {
        return analysisRepository.findById(analysisId)
            .map(a -> {
                String base = a.getResume() != null
                        ? a.getResume().getFileName().replaceAll("\\.(pdf|docx)$", "") : "resume";
                return "report_" + base + ".pdf";
            })
            .orElse("analysis_report.pdf");
    }

    // ══════════════════════════════════════════════════════════════
    //  NEW: generateImprovedResume — AI-optimized resume DOCX
    //
    //  1. Load resume text from DB
    //  2. Load analysis data (missing keywords, suggestions) if available
    //  3. Call ML service /generate-improved-resume endpoint
    //  4. Build structured DOCX via ImprovedResumeGeneratorService
    // ══════════════════════════════════════════════════════════════
    public byte[] generateImprovedResume(Long resumeId, String jobDescription, Long analysisId) throws Exception {
        // Load resume
        Resume resume = resumeRepository.findById(resumeId)
            .orElseThrow(() -> new RuntimeException("Resume not found with id: " + resumeId));

        // Load analysis context (optional)
        String missingKeywords = "";
        String suggestions     = "";
        String feedbackPoints  = "";

        if (analysisId != null) {
            Optional<ResumeAnalysis> analysisOpt = analysisRepository.findById(analysisId);
            if (analysisOpt.isPresent()) {
                ResumeAnalysis existing = analysisOpt.get();
                missingKeywords = safeString(existing.getMissingKeywords());
                suggestions     = safeString(existing.getImprovementSuggestions());
                feedbackPoints  = safeString(existing.getFeedbackPoints());
                // Use analysis's JD if caller didn't pass one
                if (jobDescription == null || jobDescription.isBlank()) {
                    jobDescription = safeString(existing.getJobDescription());
                }
            }
        }

        // Call ML service to get structured resume content
        Map<String, Object> mlResumeData = mlService.generateImprovedResume(
            resume.getExtractedText(),
            jobDescription,
            missingKeywords,
            suggestions
        );

        // Ensure candidate name is set
        if (!mlResumeData.containsKey("candidateName") || mlResumeData.get("candidateName") == null) {
            String baseName = resume.getFileName().replaceAll("\\.(pdf|docx)$", "").replaceAll("[_-]", " ");
            mlResumeData.put("candidateName", toTitleCase(baseName));
        }

        // Build and return the DOCX
        return improvedResumeGeneratorService.generateImprovedResume(mlResumeData);
    }

    // ══════════════════════════════════════════════════════════════
    //  NEW: getAnalysisHistory — Paginated history for a user
    //
    //  Returns last 10 analyses for the user, sorted newest first.
    //  Used by the History panel in CandidatePortal.
    // ══════════════════════════════════════════════════════════════
    public List<Map<String, Object>> getAnalysisHistory(Long userId) {
        // Load all resumes belonging to this user
        List<Resume> userResumes = resumeRepository.findByUserId(userId);

        if (userResumes.isEmpty()) return List.of();

        List<Long> resumeIds = userResumes.stream().map(Resume::getId).collect(Collectors.toList());

        // Load analyses for these resumes, newest first
        List<ResumeAnalysis> analyses = analysisRepository
            .findByResumeIdInOrderByAnalyzedAtDesc(resumeIds);

        // Map to lightweight DTOs for the frontend
        return analyses.stream()
            .limit(20) // return at most 20 history items
            .map(a -> {
                Map<String, Object> dto = new HashMap<>();
                dto.put("analysisId", a.getId());
                dto.put("resumeId", a.getResume() != null ? a.getResume().getId() : null);
                dto.put("fileName", a.getResume() != null ? a.getResume().getFileName() : "Unknown");
                dto.put("matchScore", a.getMatchScore() != null ? Math.round(a.getMatchScore()) : 0);
                dto.put("analyzedAt", a.getAnalyzedAt() != null ? a.getAnalyzedAt().toString() : null);
                // Truncate JD preview to 120 chars
                String jd = a.getJobDescription() != null ? a.getJobDescription() : "";
                dto.put("jobDescriptionPreview", jd.length() > 120 ? jd.substring(0, 117) + "..." : jd);
                dto.put("keywordsMatched", a.getKeywordsMatched());
                dto.put("missingKeywords", a.getMissingKeywords());
                dto.put("feedbackPoints", a.getFeedbackPoints());
                dto.put("improvementSuggestions", a.getImprovementSuggestions());
                dto.put("summary", a.getSummary());
                return dto;
            })
            .collect(Collectors.toList());
    }

    // ══════════════════════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════════════════════


    // ═══════════════════════════════════════════════════════════
    //  NEW: compareRoles
    //  Fetches resume extracted text from DB, then calls
    //  MlService.compareRoles to proxy to Flask /compare-roles.
    // ═══════════════════════════════════════════════════════════
    public Map<String, Object> compareRoles(Long resumeId, java.util.List<String> roles) {
        Resume resume = resumeRepository.findById(resumeId)
            .orElseThrow(() -> new RuntimeException("Resume not found: " + resumeId));

        String extractedText = resume.getExtractedText();
        if (extractedText == null || extractedText.isBlank()) {
            throw new RuntimeException(
                "Resume text is empty — please re-upload the resume.");
        }
        return mlService.compareRoles(extractedText, roles);
    }

    private String safeString(Object obj) {
        return obj != null ? obj.toString() : "";
    }

    private String toTitleCase(String input) {
        if (input == null || input.isBlank()) return input;
        String[] words = input.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0)))
                  .append(w.substring(1).toLowerCase())
                  .append(" ");
            }
        }
        return sb.toString().trim();
    }
}
