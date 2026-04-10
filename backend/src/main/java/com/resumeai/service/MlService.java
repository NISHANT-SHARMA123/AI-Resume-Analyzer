package com.resumeai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * MlService — communicates with the Python ML microservice
 *
 * ARCHITECTURE:
 *   React Frontend → Spring Boot (Java) → Python Flask ML Service
 *
 * WHY A SEPARATE PYTHON SERVICE?
 *   Java does not have great NLP/ML libraries.
 *   Python has spaCy, scikit-learn, TF-IDF, etc.
 *   So we use Python for the AI work and Java for the web layer.
 *
 * ENDPOINTS CALLED:
 *   POST /analyze                 — Resume vs JD analysis (existing)
 *   POST /generate-improved-resume — AI-optimized structured resume (NEW)
 */
@Service
public class MlService {

    @Value("${ml.service.url}")
    private String mlServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    // ═══════════════════════════════════════════
    //  EXISTING: analyzeResume
    // ═══════════════════════════════════════════
    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeResume(String resumeText, String jobDescription) {
        try {
            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("resume_text", resumeText);
            requestBody.put("job_description", jobDescription);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                mlServiceUrl + "/analyze",
                HttpMethod.POST,
                request,
                Map.class
            );

            return response.getBody();

        } catch (Exception e) {
            System.err.println("ML Service error: " + e.getMessage());
            return getFallbackAnalysis(resumeText, jobDescription);
        }
    }

    // ═══════════════════════════════════════════
    //  NEW: generateImprovedResume
    //
    //  Calls the Python /generate-improved-resume endpoint.
    //  Returns a structured map the ImprovedResumeGeneratorService
    //  uses to build the DOCX.
    //
    //  Expected response fields from Python:
    //    candidateName      String
    //    professionalSummary String
    //    skills             List<String>
    //    experience         List<{title,company,period,bullets[]}>
    //    education          List<{degree,institution,year}>
    //    improvements       List<String>   (AI-applied changes)
    // ═══════════════════════════════════════════
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateImprovedResume(
            String resumeText,
            String jobDescription,
            String missingKeywords,
            String suggestions) {
        try {
            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("resume_text",     resumeText);
            requestBody.put("job_description", jobDescription != null ? jobDescription : "");
            requestBody.put("missing_keywords",missingKeywords != null ? missingKeywords : "");
            requestBody.put("suggestions",     suggestions != null ? suggestions : "");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                mlServiceUrl + "/generate-improved-resume",
                HttpMethod.POST,
                request,
                Map.class
            );

            Map<String, Object> body = response.getBody();
            return body != null ? body : getFallbackImprovedResume(resumeText, missingKeywords);

        } catch (Exception e) {
            System.err.println("ML Service /generate-improved-resume error: " + e.getMessage());
            return getFallbackImprovedResume(resumeText, missingKeywords);
        }
    }

    // ═══════════════════════════════════════════
    //  FALLBACK: Basic analysis when ML is down
    // ═══════════════════════════════════════════
    private Map<String, Object> getFallbackAnalysis(String resumeText, String jobDescription) {
        Map<String, Object> result = new HashMap<>();

        String[] jdWords = jobDescription.toLowerCase().split("\\W+");
        String resumeLower = resumeText.toLowerCase();

        StringBuilder matched = new StringBuilder();
        StringBuilder missing = new StringBuilder();
        int matchCount = 0;

        for (String word : jdWords) {
            if (word.length() > 3) {
                if (resumeLower.contains(word)) {
                    if (matched.length() > 0) matched.append(",");
                    matched.append(word);
                    matchCount++;
                } else {
                    if (missing.length() > 0) missing.append(",");
                    missing.append(word);
                }
            }
        }

        double score = jdWords.length > 0
            ? Math.min(100.0, (matchCount * 100.0) / Math.max(1, jdWords.length))
            : 50.0;

        result.put("matchScore", Math.round(score * 10.0) / 10.0);
        result.put("keywordsMatched", matched.toString());
        result.put("missingKeywords", missing.toString());
        result.put("feedbackPoints",
            "- Resume has been analyzed with basic keyword matching\n" +
            "- Connect the Python ML service for detailed AI feedback\n" +
            "- Add more keywords from the job description to improve your score");
        result.put("improvementSuggestions",
            "1. Start the Python ML microservice for AI-powered analysis\n" +
            "2. Add quantifiable achievements to your resume\n" +
            "3. Tailor your skills section to match the job description");
        result.put("summary", "Resume analyzed with basic keyword matching. " +
            "Please start the Python ML service for full AI analysis.");

        return result;
    }


    // ═══════════════════════════════════════════════════════════
    //  NEW: compareRoles
    //  Calls Flask /compare-roles with resume text + role list.
    //  Falls back to keyword heuristics if Flask is offline.
    // ═══════════════════════════════════════════════════════════
    @SuppressWarnings("unchecked")
    public Map<String, Object> compareRoles(String resumeText,
                                            java.util.List<String> roles) {
        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("resume_text", resumeText);
            requestBody.put("roles", roles);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request =
                new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                mlServiceUrl + "/compare-roles",
                HttpMethod.POST,
                request,
                Map.class
            );
            Map<String, Object> body = response.getBody();
            return body != null ? body
                                : getFallbackCompareRoles(resumeText, roles);

        } catch (Exception e) {
            System.err.println("ML /compare-roles error: " + e.getMessage());
            return getFallbackCompareRoles(resumeText, roles);
        }
    }

    // ── Fallback when Flask is offline ──────────────────────────
    private Map<String, Object> getFallbackCompareRoles(
            String resumeText, java.util.List<String> roles) {

        Map<String, Object> result = new HashMap<>();
        java.util.List<Map<String, Object>> roleResults = new ArrayList<>();
        String resumeLower = resumeText.toLowerCase();

        // Simple per-role keyword banks used as fallback scoring
        Map<String, java.util.List<String>> roleKws = new HashMap<>();
        roleKws.put("Frontend Developer",
            Arrays.asList("react","javascript","typescript","html","css","angular","vue"));
        roleKws.put("Java Developer",
            Arrays.asList("java","spring","spring boot","microservices","rest","maven","junit"));
        roleKws.put("Data Analyst",
            Arrays.asList("sql","python","pandas","excel","tableau","power bi","statistics"));
        roleKws.put("ML Engineer",
            Arrays.asList("machine learning","python","tensorflow","pytorch","scikit-learn","nlp"));
        roleKws.put("DevOps Engineer",
            Arrays.asList("docker","kubernetes","aws","ci/cd","terraform","jenkins","linux"));
        roleKws.put("Digital Marketing Intern",
            Arrays.asList("seo","social media","google analytics","content","email marketing","canva"));
        roleKws.put("HR Intern",
            Arrays.asList("recruitment","screening","onboarding","hrms","interview","talent"));
        roleKws.put("Sales Executive",
            Arrays.asList("lead generation","crm","sales pipeline","cold calling","revenue","target"));
        roleKws.put("Finance Intern",
            Arrays.asList("excel","tally","gst","reconciliation","bookkeeping","mis"));
        roleKws.put("Content Writer",
            Arrays.asList("content writing","seo writing","copywriting","blog","editing","research"));

        double bestScore = 0;  String bestRole  = roles.isEmpty() ? "General" : roles.get(0);
        double worstScore = 101; String worstRole = bestRole;

        for (String role : roles) {
            java.util.List<String> kws =
                roleKws.getOrDefault(role, Arrays.asList("communication","teamwork","excel"));
            long hits = kws.stream().filter(resumeLower::contains).count();
            double score = kws.isEmpty() ? 50.0
                : Math.min(95.0, 30.0 + (hits * 65.0 / kws.size()));
            score = Math.round(score * 10.0) / 10.0;

            Map<String, Object> r = new HashMap<>();
            r.put("role",          role);
            r.put("atsScore",      score);
            r.put("semanticScore", Math.round(score * 0.9 * 10.0) / 10.0);
            r.put("matchedSkills", kws.stream()
                    .filter(resumeLower::contains).limit(5).toList());
            r.put("missingSkills", java.util.List.of());
            r.put("roleTip",
                "Start ML service (python app.py) for detailed AI gap analysis.");
            r.put("semanticFit",
                "Basic keyword fallback — start app.py for full semantic scoring.");
            roleResults.add(r);

            if (score > bestScore)  { bestScore = score;  bestRole  = role; }
            if (score < worstScore) { worstScore = score; worstRole = role; }
        }
        roleResults.sort((a, b) -> Double.compare(
            ((Number) b.get("atsScore")).doubleValue(),
            ((Number) a.get("atsScore")).doubleValue()));

        result.put("results",         roleResults);
        result.put("bestFitRole",     bestRole);
        result.put("bestFitScore",    bestScore);
        result.put("worstFitRole",    worstRole);
        result.put("worstFitScore",   worstScore);
        result.put("recommendation",
            "ML service offline — keyword fallback used. " +
            "Start app.py for full AI role comparison.");
        return result;
    }


    /**
     * Fallback improved resume when ML service is unavailable.
     * Generates a minimal structured response from raw resume text.
     */
    private Map<String, Object> getFallbackImprovedResume(String resumeText, String missingKeywords) {
        Map<String, Object> result = new HashMap<>();
        result.put("candidateName", "Candidate");
        result.put("professionalSummary",
            "Experienced professional seeking to leverage skills and experience in a challenging new role. " +
            "Demonstrated ability to deliver results in fast-paced environments.");

        // Build skills list from missing keywords + some generic ones
        List<String> skills = new ArrayList<>();
        if (missingKeywords != null && !missingKeywords.isBlank()) {
            for (String kw : missingKeywords.split(",")) {
                String trimmed = kw.trim();
                if (!trimmed.isEmpty()) skills.add(trimmed);
            }
        }
        if (skills.isEmpty()) {
            skills.addAll(Arrays.asList("Communication", "Problem-Solving", "Team Collaboration",
                    "Project Management", "Analytical Thinking"));
        }
        result.put("skills", skills);

        // Minimal experience placeholder
        Map<String, Object> job = new HashMap<>();
        job.put("title", "Professional Role");
        job.put("company", "Company Name");
        job.put("period", "Year – Present");
        job.put("bullets", Arrays.asList(
            "Delivered key projects on time, meeting all stakeholder requirements",
            "Collaborated cross-functionally to drive process improvements",
            "Utilized data-driven insights to inform decision making"
        ));
        result.put("experience", List.of(job));
        result.put("education", List.of());

        result.put("improvements", Arrays.asList(
            "ML service was unavailable — this is a template resume. Start the Python service for AI optimization.",
            "Add your actual work experience, education, and skills.",
            "Tailor the professional summary to the target job description."
        ));

        return result;
    }
}
