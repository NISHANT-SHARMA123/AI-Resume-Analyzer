package com.resumeai.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * DTO = Data Transfer Object
 * These classes carry data between the frontend and backend.
 * They are NOT stored in the database — they are just for API communication.
 */

// ──────────────────────────────────────────────────────────
//  AUTH DTOs
// ──────────────────────────────────────────────────────────

// What the frontend sends when registering
class RegisterRequest {
    public String name;
    public String email;
    public String password;
    public String role; // "CANDIDATE" or "INTERVIEWER"
}

// What the frontend sends when logging in
class LoginRequest {
    public String email;
    public String password;
}

// What the backend sends back after login/register
@Data @Builder @NoArgsConstructor @AllArgsConstructor
class AuthResponse {
    private boolean success;
    private String message;
    private Long userId;
    private String name;
    private String email;
    private String role;
    private String token; // JWT token
}

// ──────────────────────────────────────────────────────────
//  RESUME DTOs
// ──────────────────────────────────────────────────────────

// What backend sends after uploading a resume
@Data @Builder @NoArgsConstructor @AllArgsConstructor
class UploadResponse {
    private boolean success;
    private Long resumeId;
    private String fileName;
    private String message;
}

// What frontend sends to analyze a resume
@Data
class AnalyzeRequest {
    public Long resumeId;
    public String jobDescription;
}

// What backend sends back after analysis
@Data @Builder @NoArgsConstructor @AllArgsConstructor
class AnalysisResponse {
    private Long analysisId;
    private Double matchScore;
    private String keywordsMatched;
    private String missingKeywords;
    private String feedbackPoints;
    private String improvementSuggestions;
    private String summary;
}

// ──────────────────────────────────────────────────────────
//  INTERVIEWER DTOs
// ──────────────────────────────────────────────────────────

// Each ranked candidate result in bulk upload response
@Data @Builder @NoArgsConstructor @AllArgsConstructor
class RankedCandidate {
    private Long analysisId;
    private String fileName;
    private Double matchScore;
    private String keywordsMatched;
    private String missingKeywords;
    private String summary;
    private String decision;
}

// What backend sends back after bulk upload
@Data @Builder @NoArgsConstructor @AllArgsConstructor
class BulkUploadResponse {
    private boolean success;
    private int totalResumes;
    private java.util.List<RankedCandidate> rankedCandidates;
}

// What frontend sends to update Accept/Reject decision
@Data
class DecisionRequest {
    public String decision; // "ACCEPTED" or "REJECTED"
}

// ──────────────────────────────────────────────────────────
//  ML SERVICE DTOs (for talking to Python microservice)
// ──────────────────────────────────────────────────────────

@Data @Builder @NoArgsConstructor @AllArgsConstructor
class MlRequest {
    private String resumeText;
    private String jobDescription;
}

@Data
class MlResponse {
    public Double matchScore;
    public String keywordsMatched;
    public String missingKeywords;
    public String feedbackPoints;
    public String improvementSuggestions;
    public String summary;
}
