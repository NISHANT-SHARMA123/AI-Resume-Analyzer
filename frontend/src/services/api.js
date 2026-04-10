import axios from 'axios';

const BASE_URL = 'http://localhost:8080/api';

// ── Auth Helpers ──────────────────────────────────────
export function saveAuthData(data) {
  localStorage.setItem('resumeai_user', JSON.stringify({
    userId: data.userId,
    userName: data.name,
    role: data.role,
    token: data.token,
  }));
}

export function getAuthData() {
  const raw = localStorage.getItem('resumeai_user');
  if (!raw) return {};
  return JSON.parse(raw);
}

export function logout() {
  localStorage.removeItem('resumeai_user');
}

function authHeaders() {
  const { token } = getAuthData();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth APIs ─────────────────────────────────────────
export const registerUser = (data) =>
  axios.post(`${BASE_URL}/auth/register`, data);

export const loginUser = (data) =>
  axios.post(`${BASE_URL}/auth/login`, data);

// ── Candidate APIs ────────────────────────────────────
export const uploadResume = (file, userId) => {
  const form = new FormData();
  form.append('file', file);
  form.append('userId', userId);
  return axios.post(`${BASE_URL}/resume/upload`, form, {
    headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
  });
};

export const analyzeResume = (resumeId, jobDescription) =>
  axios.post(`${BASE_URL}/resume/analyze`, { resumeId, jobDescription }, {
    headers: authHeaders(),
  });

export const generateSummary = (resumeId) =>
  axios.post(`${BASE_URL}/resume/summary`, { resumeId }, {
    headers: authHeaders(),
  });

export const improveResume = (resumeId) =>
  axios.post(`${BASE_URL}/resume/improve`, { resumeId }, {
    headers: authHeaders(),
  });

// Candidate: download analysis report PDF
export const downloadAnalysisReport = (analysisId) =>
  axios.get(`${BASE_URL}/resume/report/${analysisId}`, {
    headers: authHeaders(),
    responseType: 'blob',
  });

// Candidate: generate AI-improved DOCX
export const generateImprovedResume = (resumeId, jobDescription, analysisId) =>
  axios.post(`${BASE_URL}/resume/generate-improved`,
    { resumeId, jobDescription, analysisId },
    { headers: authHeaders(), responseType: 'blob', timeout: 30000 }
  );

// Candidate: analysis history
export const getAnalysisHistory = (userId) =>
  axios.get(`${BASE_URL}/resume/history/${userId}`, { headers: authHeaders() });

// ── Interviewer APIs — EXISTING ───────────────────────
export const bulkUploadResumes = (files, jd, userId) => {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  form.append('jobDescription', jd);
  form.append('userId', userId);
  return axios.post(`${BASE_URL}/interviewer/bulk-upload`, form, {
    headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
  });
};

export const updateCandidateDecision = (analysisId, decision) =>
  axios.put(`${BASE_URL}/interviewer/decision/${analysisId}`, { decision }, {
    headers: authHeaders(),
  });

export const downloadResume = (resumeId) =>
  axios.get(`${BASE_URL}/resume/download/${resumeId}`, {
    headers: authHeaders(),
    responseType: 'blob',
  });

// ── Interviewer APIs — NEW ────────────────────────────

// Fetch structured AI summary for one candidate (summary modal)
export const getCandidateSummary = (analysisId) =>
  axios.get(`${BASE_URL}/interviewer/summary/${analysisId}`, {
    headers: authHeaders(),
  });

// Download the original resume file (by analysisId)
export const downloadResumeByAnalysis = (analysisId) =>
  axios.get(`${BASE_URL}/interviewer/resume-file/${analysisId}`, {
    headers: authHeaders(),
    responseType: 'blob',
  });

// Interviewer analysis history
export const getInterviewerHistory = (interviewerId) =>
  axios.get(`${BASE_URL}/interviewer/history/${interviewerId}`, {
    headers: authHeaders(),
  });

// All accepted candidates for this interviewer
export const getAcceptedCandidates = (interviewerId) =>
  axios.get(`${BASE_URL}/interviewer/accepted/${interviewerId}`, {
    headers: authHeaders(),
  });

// Download ZIP of all accepted resumes + report
export const downloadAcceptedZip = (interviewerId) =>
  axios.get(`${BASE_URL}/interviewer/bulk-download/${interviewerId}`, {
    headers: authHeaders(),
    responseType: 'blob',
    timeout: 60000, // ZIP can take time for many files
  });

// ── Shared helper: trigger blob download in browser ───

// ── Clear all interviewer history ──────────────────────────────
export const clearInterviewerHistory = (interviewerId) =>
  axios.delete(`${API}/interviewer/history/${interviewerId}`);

// ── What-If multi-role comparison ──────────────────────────────
export const compareRoles = (resumeId, roles) =>
  axios.post(`${API}/resume/compare-roles`, { resumeId, roles });

export function triggerBlobDownload(blobData, fileName) {
  const url = window.URL.createObjectURL(new Blob([blobData]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
