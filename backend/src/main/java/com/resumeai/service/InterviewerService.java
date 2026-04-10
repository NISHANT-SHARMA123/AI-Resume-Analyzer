package com.resumeai.service;

import com.resumeai.model.Resume;
import com.resumeai.model.ResumeAnalysis;
import com.resumeai.model.User;
import com.resumeai.repository.ResumeAnalysisRepository;
import com.resumeai.repository.ResumeRepository;
import com.resumeai.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.zip.*;

/**
 * InterviewerService — all business logic for the Interviewer Portal
 *
 * EXISTING:
 *   bulkAnalyze()      — process multiple resumes and rank by score
 *   updateDecision()   — accept or reject a candidate
 *
 * NEW:
 *   getCandidateSummary()          — structured summary for one analysis
 *   getResumeFileBytes()           — raw file bytes for download
 *   getResumeFileName()            — original filename for Content-Disposition
 *   getHistory()                   — paginated history for an interviewer
 *   getAcceptedCandidates()        — all ACCEPTED analyses for an interviewer
 *   buildAcceptedCandidatesZip()   — ZIP archive of all accepted resumes + report
 */
@Service
public class InterviewerService {

    @Autowired private ResumeRepository resumeRepository;
    @Autowired private ResumeAnalysisRepository analysisRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private FileParserService fileParserService;
    @Autowired private MlService mlService;

    @Value("${app.upload.dir}")
    private String uploadDir;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm");

    // ═══════════════════════════════════════════════════════
    //  EXISTING: bulkAnalyze
    // ═══════════════════════════════════════════════════════

    public Map<String, Object> bulkAnalyze(MultipartFile[] files,
                                            String jobDescription,
                                            Long interviewerId) throws IOException {
        User interviewer = userRepository.findById(interviewerId).orElse(null);

        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) Files.createDirectories(uploadPath);

        List<Map<String, Object>> rankedCandidates = new ArrayList<>();

        for (MultipartFile file : files) {
            try {
                rankedCandidates.add(processOneResume(file, jobDescription, interviewer, uploadPath));
            } catch (Exception e) {
                System.err.println("Failed to process: " + file.getOriginalFilename() + " → " + e.getMessage());
                Map<String, Object> err = new HashMap<>();
                err.put("fileName", file.getOriginalFilename());
                err.put("matchScore", 0.0);
                err.put("decision", "PENDING");
                err.put("error", "Failed to process this resume");
                rankedCandidates.add(err);
            }
        }

        rankedCandidates.sort((a, b) -> Double.compare(
                ((Number) b.getOrDefault("matchScore", 0.0)).doubleValue(),
                ((Number) a.getOrDefault("matchScore", 0.0)).doubleValue()
        ));

        return Map.of(
            "success", true,
            "totalResumes", files.length,
            "rankedCandidates", rankedCandidates
        );
    }

    private Map<String, Object> processOneResume(MultipartFile file,
                                                   String jobDescription,
                                                   User interviewer,
                                                   Path uploadPath) throws IOException {
        String uniqueId = UUID.randomUUID().toString().substring(0, 8);
        String savedFileName = uniqueId + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(savedFileName);
        Files.copy(file.getInputStream(), filePath);

        String extractedText = fileParserService.extractText(file);

        Resume resume = new Resume();
        resume.setUser(interviewer);
        resume.setFileName(file.getOriginalFilename());
        resume.setFilePath(filePath.toString());
        resume.setFileType(file.getOriginalFilename().endsWith(".pdf") ? "PDF" : "DOCX");
        resume.setFileSize(file.getSize());
        resume.setExtractedText(extractedText);
        Resume saved = resumeRepository.save(resume);

        Map<String, Object> mlResult = mlService.analyzeResume(extractedText, jobDescription);
        Double matchScore = mlResult.get("matchScore") instanceof Number
                ? ((Number) mlResult.get("matchScore")).doubleValue() : 0.0;

        ResumeAnalysis analysis = new ResumeAnalysis();
        analysis.setResume(saved);
        analysis.setAnalyzedBy(interviewer);
        analysis.setJobDescription(jobDescription);
        analysis.setMatchScore(matchScore);
        analysis.setKeywordsMatched(safeStr(mlResult.get("keywordsMatched")));
        analysis.setMissingKeywords(safeStr(mlResult.get("missingKeywords")));
        analysis.setFeedbackPoints(safeStr(mlResult.get("feedbackPoints")));
        analysis.setImprovementSuggestions(safeStr(mlResult.get("improvementSuggestions")));
        analysis.setSummary(safeStr(mlResult.get("summary")));
        // ── NEW: multi-dimensional sub-scores ──────────────────────
        analysis.setSkillScore(safeDouble(mlResult.get("skillScore")));
        analysis.setExperienceScore(safeDouble(mlResult.get("experienceScore")));
        analysis.setProjectScore(safeDouble(mlResult.get("projectScore")));
        analysis.setResumeQualityScore(safeDouble(mlResult.get("resumeQualityScore")));
        analysis.setDecision(ResumeAnalysis.Decision.PENDING);
        ResumeAnalysis savedAnalysis = analysisRepository.save(analysis);

        // Return enriched map — includes resumeId so frontend can drive downloads
        Map<String, Object> result = new HashMap<>();
        result.put("analysisId",    savedAnalysis.getId());
        result.put("resumeId",      saved.getId());
        result.put("fileName",      file.getOriginalFilename());
        result.put("matchScore",    matchScore);
        result.put("keywordsMatched",       analysis.getKeywordsMatched());
        result.put("missingKeywords",       analysis.getMissingKeywords());
        result.put("feedbackPoints",        analysis.getFeedbackPoints());
        result.put("improvementSuggestions",analysis.getImprovementSuggestions());
        result.put("summary",       analysis.getSummary());
        result.put("decision",      "PENDING");
        // ── NEW: expose sub-scores in ranked results ──────────────
        if (savedAnalysis.getSkillScore()         != null) result.put("skillScore",         savedAnalysis.getSkillScore());
        if (savedAnalysis.getExperienceScore()    != null) result.put("experienceScore",    savedAnalysis.getExperienceScore());
        if (savedAnalysis.getProjectScore()       != null) result.put("projectScore",       savedAnalysis.getProjectScore());
        if (savedAnalysis.getResumeQualityScore() != null) result.put("resumeQualityScore", savedAnalysis.getResumeQualityScore());
        result.put("analyzedAt",    savedAnalysis.getAnalyzedAt() != null
                ? savedAnalysis.getAnalyzedAt().format(DATE_FMT) : "");
        return result;
    }

    // ═══════════════════════════════════════════════════════
    //  EXISTING: updateDecision
    // ═══════════════════════════════════════════════════════

    public Map<String, Object> updateDecision(Long analysisId, String decision) {
        ResumeAnalysis analysis = analysisRepository.findById(analysisId)
            .orElseThrow(() -> new RuntimeException("Analysis not found: " + analysisId));
        analysis.setDecision(ResumeAnalysis.Decision.valueOf(decision.toUpperCase()));
        analysisRepository.save(analysis);
        return Map.of("success", true, "analysisId", analysisId, "decision", decision);
    }

    // ═══════════════════════════════════════════════════════
    //  NEW: getCandidateSummary
    //
    //  Returns a richly-structured summary for one analysis.
    //  The full analysis data is already in the DB — this method
    //  shapes it into clearly labelled sections for the UI modal.
    // ═══════════════════════════════════════════════════════
    public Map<String, Object> getCandidateSummary(Long analysisId) {
        ResumeAnalysis analysis = analysisRepository.findById(analysisId)
            .orElseThrow(() -> new RuntimeException("Analysis not found: " + analysisId));

        Resume resume = analysis.getResume();

        // Parse comma-separated keyword lists into arrays for the frontend
        List<String> matched = parseCSV(analysis.getKeywordsMatched());
        List<String> missing = parseCSV(analysis.getMissingKeywords());

        // Parse newline-separated feedback into list items
        List<String> feedback    = parseLines(analysis.getFeedbackPoints());
        List<String> suggestions = parseLines(analysis.getImprovementSuggestions());

        // Derive suitability label from match score
        int score = analysis.getMatchScore() != null
                ? (int) Math.round(analysis.getMatchScore()) : 0;
        String suitability = score >= 80 ? "Highly Suitable"
                : score >= 60 ? "Suitable"
                : score >= 40 ? "Partially Suitable"
                : "Not Suitable";

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("analysisId",    analysis.getId());
        dto.put("fileName",      resume != null ? resume.getFileName() : "Unknown");
        dto.put("resumeId",      resume != null ? resume.getId() : null);
        dto.put("matchScore",    score);
        dto.put("suitability",   suitability);
        dto.put("summary",       safeStr(analysis.getSummary()));
        dto.put("keywordsMatched",  matched);
        dto.put("missingKeywords",  missing);
        dto.put("feedbackPoints",   feedback);
        dto.put("suggestions",      suggestions);
        dto.put("decision",      analysis.getDecision() != null
                ? analysis.getDecision().name() : "PENDING");
        dto.put("analyzedAt",    analysis.getAnalyzedAt() != null
                ? analysis.getAnalyzedAt().format(DATE_FMT) : "");
        dto.put("jobDescription", truncate(safeStr(analysis.getJobDescription()), 300));
        // ── NEW: sub-scores for summary modal breakdown ────────────
        dto.put("skillScore",         analysis.getSkillScore());
        dto.put("experienceScore",    analysis.getExperienceScore());
        dto.put("projectScore",       analysis.getProjectScore());
        dto.put("resumeQualityScore", analysis.getResumeQualityScore());
        return dto;
    }

    // ═══════════════════════════════════════════════════════
    //  NEW: getResumeFileBytes / getResumeFileName
    //
    //  Looks up the resume file path from the DB (via analysisId)
    //  and reads it from disk. Used by the "Download Resume" button.
    // ═══════════════════════════════════════════════════════
    public byte[] getResumeFileBytes(Long analysisId) throws IOException {
        ResumeAnalysis analysis = analysisRepository.findById(analysisId)
            .orElseThrow(() -> new RuntimeException("Analysis not found: " + analysisId));
        Resume resume = analysis.getResume();
        if (resume == null) throw new RuntimeException("No resume attached to analysis " + analysisId);
        return Files.readAllBytes(Paths.get(resume.getFilePath()));
    }

    public String getResumeFileName(Long analysisId) {
        return analysisRepository.findById(analysisId)
            .map(a -> a.getResume() != null ? a.getResume().getFileName() : "resume.pdf")
            .orElse("resume.pdf");
    }

    // ═══════════════════════════════════════════════════════
    //  NEW: getHistory
    //
    //  Returns the most recent 50 analyses by this interviewer,
    //  sorted newest first. Each row includes everything the
    //  History tab needs: name, score, decision, date, analysisId.
    // ═══════════════════════════════════════════════════════
    public List<Map<String, Object>> getHistory(Long interviewerId) {
        List<ResumeAnalysis> analyses =
                analysisRepository.findByAnalyzedByIdOrderByAnalyzedAtDesc(interviewerId);

        return analyses.stream()
            .limit(50)
            .map(a -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("analysisId",  a.getId());
                row.put("resumeId",    a.getResume() != null ? a.getResume().getId() : null);
                row.put("fileName",    a.getResume() != null ? a.getResume().getFileName() : "Unknown");
                row.put("matchScore",  a.getMatchScore() != null ? Math.round(a.getMatchScore()) : 0);
                row.put("decision",    a.getDecision() != null ? a.getDecision().name() : "PENDING");
                row.put("analyzedAt",  a.getAnalyzedAt() != null ? a.getAnalyzedAt().format(DATE_FMT) : "");
                row.put("summary",     truncate(safeStr(a.getSummary()), 180));
                row.put("keywordsMatched", safeStr(a.getKeywordsMatched()));
                row.put("jobDescPreview",  truncate(safeStr(a.getJobDescription()), 100));
                return row;
            })
            .collect(Collectors.toList());
    }

    // ═══════════════════════════════════════════════════════
    //  NEW: getAcceptedCandidates
    //
    //  Returns all ACCEPTED analyses by this interviewer,
    //  sorted by match score (highest first).
    // ═══════════════════════════════════════════════════════
    public List<Map<String, Object>> getAcceptedCandidates(Long interviewerId) {
        List<ResumeAnalysis> accepted =
                analysisRepository.findByAnalyzedByIdAndDecisionOrderByMatchScoreDesc(
                        interviewerId, ResumeAnalysis.Decision.ACCEPTED);

        return accepted.stream().map(a -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("analysisId",    a.getId());
            row.put("resumeId",      a.getResume() != null ? a.getResume().getId() : null);
            row.put("fileName",      a.getResume() != null ? a.getResume().getFileName() : "Unknown");
            row.put("matchScore",    a.getMatchScore() != null ? Math.round(a.getMatchScore()) : 0);
            row.put("decision",      "ACCEPTED");
            row.put("analyzedAt",    a.getAnalyzedAt() != null ? a.getAnalyzedAt().format(DATE_FMT) : "");
            row.put("summary",       safeStr(a.getSummary()));
            row.put("keywordsMatched", safeStr(a.getKeywordsMatched()));
            row.put("missingKeywords", safeStr(a.getMissingKeywords()));
            row.put("feedbackPoints",  safeStr(a.getFeedbackPoints()));
            return row;
        }).collect(Collectors.toList());
    }

    // ═══════════════════════════════════════════════════════
    //  NEW: buildAcceptedCandidatesZip
    //
    //  Builds a ZIP archive (in memory) containing:
    //    resumes/       — original resume files, one per candidate
    //    manifest.txt   — tab-separated list: rank, name, score, date
    //    report.txt     — full text report with summaries & feedback
    //
    //  The ZIP is assembled in a ByteArrayOutputStream so no
    //  temporary file is written to disk.
    // ═══════════════════════════════════════════════════════
    public byte[] buildAcceptedCandidatesZip(Long interviewerId) throws IOException {
        List<ResumeAnalysis> accepted =
                analysisRepository.findByAnalyzedByIdAndDecisionOrderByMatchScoreDesc(
                        interviewerId, ResumeAnalysis.Decision.ACCEPTED);

        if (accepted.isEmpty()) {
            throw new RuntimeException("No accepted candidates found for this interviewer.");
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        try (ZipOutputStream zip = new ZipOutputStream(baos)) {
            zip.setLevel(Deflater.BEST_COMPRESSION);

            StringBuilder manifest = new StringBuilder();
            manifest.append("ResumeAI — Accepted Candidates Report\n");
            manifest.append("Generated: ").append(new Date()).append("\n");
            manifest.append("Total Accepted: ").append(accepted.size()).append("\n\n");
            manifest.append(String.format("%-5s %-40s %-10s %-20s%n",
                    "Rank", "Resume File", "Score", "Analyzed At"));
            manifest.append("-".repeat(80)).append("\n");

            StringBuilder fullReport = new StringBuilder();
            fullReport.append("ResumeAI — Accepted Candidates Full Report\n");
            fullReport.append("=".repeat(60)).append("\n\n");

            int rank = 1;
            for (ResumeAnalysis a : accepted) {
                Resume resume = a.getResume();
                String fileName = resume != null ? resume.getFileName() : "unknown.pdf";
                int score = a.getMatchScore() != null ? (int) Math.round(a.getMatchScore()) : 0;
                String dateStr = a.getAnalyzedAt() != null ? a.getAnalyzedAt().format(DATE_FMT) : "";

                // ── Add resume file to ZIP ──────────────────────────
                if (resume != null && resume.getFilePath() != null) {
                    Path filePath = Paths.get(resume.getFilePath());
                    if (Files.exists(filePath)) {
                        ZipEntry entry = new ZipEntry("resumes/" + rank + "_" + fileName);
                        zip.putNextEntry(entry);
                        zip.write(Files.readAllBytes(filePath));
                        zip.closeEntry();
                    }
                }

                // ── Manifest row ────────────────────────────────────
                manifest.append(String.format("%-5d %-40s %-10s %-20s%n",
                        rank, fileName, score + "%", dateStr));

                // ── Full report section for this candidate ──────────
                fullReport.append("CANDIDATE #").append(rank).append("\n");
                fullReport.append("-".repeat(40)).append("\n");
                fullReport.append("File       : ").append(fileName).append("\n");
                fullReport.append("Score      : ").append(score).append("%\n");
                fullReport.append("Analyzed   : ").append(dateStr).append("\n");
                fullReport.append("Suitability: ").append(getSuitabilityLabel(score)).append("\n\n");

                if (!safeStr(a.getSummary()).isBlank()) {
                    fullReport.append("Summary:\n").append(a.getSummary()).append("\n\n");
                }
                if (!safeStr(a.getKeywordsMatched()).isBlank()) {
                    fullReport.append("Keywords Matched:\n  ").append(a.getKeywordsMatched()).append("\n\n");
                }
                if (!safeStr(a.getMissingKeywords()).isBlank()) {
                    fullReport.append("Missing Keywords:\n  ").append(a.getMissingKeywords()).append("\n\n");
                }
                if (!safeStr(a.getFeedbackPoints()).isBlank()) {
                    fullReport.append("AI Feedback:\n").append(a.getFeedbackPoints()).append("\n\n");
                }
                fullReport.append("=".repeat(60)).append("\n\n");

                rank++;
            }

            // ── Write manifest.txt ──────────────────────────────────
            addTextEntry(zip, "manifest.txt", manifest.toString());

            // ── Write report.txt ────────────────────────────────────
            addTextEntry(zip, "report.txt", fullReport.toString());
        }

        return baos.toByteArray();
    }

    // ═══════════════════════════════════════════════════════
    //  NEW: clearHistory
    //
    //  Deletes all ResumeAnalysis records where
    //  analyzed_by = interviewerId.
    //  Resume records and uploaded files on disk are NOT deleted.
    // ═══════════════════════════════════════════════════════
    public void clearHistory(Long interviewerId) {
        List<ResumeAnalysis> analyses =
                analysisRepository.findByAnalyzedByIdOrderByAnalyzedAtDesc(interviewerId);
        analysisRepository.deleteAll(analyses);
    }

        // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════

    private void addTextEntry(ZipOutputStream zip, String name, String content) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        zip.putNextEntry(entry);
        zip.write(content.getBytes("UTF-8"));
        zip.closeEntry();
    }

    private List<String> parseCSV(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    private List<String> parseLines(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("\n"))
                .map(s -> s.replaceAll("^[-•*✅⚡⚠️❌💡\\d.]+\\s*", "").trim())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max - 3) + "..." : s;
    }

    private String getSuitabilityLabel(int score) {
        if (score >= 80) return "Highly Suitable";
        if (score >= 60) return "Suitable";
        if (score >= 40) return "Partially Suitable";
        return "Not Suitable";
    }

    private String safeStr(Object obj) {
        return obj != null ? obj.toString() : "";
    }

    /**
     * Safely extract a Double from the ML result map.
     * Returns null when the field is absent so the UI can distinguish
     * "score is 0" from "score was not computed".
     */
    private Double safeDouble(Object obj) {
        if (obj == null) return null;
        try { return ((Number) obj).doubleValue(); }
        catch (ClassCastException e) {
            try { return Double.parseDouble(obj.toString()); }
            catch (NumberFormatException ex) { return null; }
        }
    }
}
