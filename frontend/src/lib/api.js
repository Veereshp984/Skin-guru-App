// export const MODEL_NAME = "ensemble";
export const MODEL_NAME = "cnn";
export const API_BASE = getApiBase();
const ACCESS_TOKEN_KEY = "skinGuruAccessToken";

let accessToken =
  typeof window !== "undefined" ? window.sessionStorage.getItem(ACCESS_TOKEN_KEY) || "" : "";

export function setAccessToken(token) {
  accessToken = token || "";
  if (typeof window === "undefined") {
    return;
  }
  if (accessToken) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getAccessToken() {
  return accessToken;
}

export async function analyzeSkinImage(imageFile, source = "upload") {
  const formData = new FormData();
  formData.append("file", imageFile);

  try {
    const response = await authFetch(`${API_BASE}/api/predict?model=${MODEL_NAME}&source=${source}`, {
      method: "POST",
      body: formData,
    });

    const payload = await parseApiResponse(response);
    if (!response.ok) {
      throw new Error(payload.detail || `Analysis failed with status ${response.status}.`);
    }

    return payload;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the SkinGuru API. Check that VITE_API_BASE_URL uses your HTTPS Render URL and wait a moment if the free backend is waking up.",
      );
    }

    throw error;
  }
}

export async function getPredictionHistory(skip = 0, limit = 20) {
  return authRequest(`/api/predictions?skip=${skip}&limit=${limit}`);
}

export async function getPrediction(reportId) {
  return authRequest(`/api/predictions/${reportId}`);
}

export async function registerUser(payload) {
  return authRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload) {
  return authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginWithGoogle(credential, role = "patient") {
  return authRequest("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential, role }),
  });
}

export async function refreshSession() {
  return authRequest("/api/auth/refresh", { method: "POST" });
}

export async function logoutUser() {
  const response = await authFetch(`${API_BASE}/api/auth/logout`, { method: "POST" }, false);
  setAccessToken("");
  if (!response.ok && response.status !== 401) {
    const payload = await parseApiResponse(response);
    throw new Error(payload.detail || "Logout failed.");
  }
}

export async function getProfile() {
  return authRequest("/api/auth/me");
}

export async function updateProfile(payload) {
  return authRequest("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getRoleDashboard(role) {
  return authRequest(`/api/${role}/dashboard`);
}

export async function authRequest(path, options = {}) {
  const response = await authFetch(`${API_BASE}${path}`, options);
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed with status ${response.status}.`);
  }
  if (payload.access_token) {
    setAccessToken(payload.access_token);
  }
  return payload;
}

export async function authFetch(url, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retry && !url.includes("/api/auth/refresh")) {
    try {
      await refreshSession();
      return authFetch(url, options, false);
    } catch {
      setAccessToken("");
    }
  }

  return response;
}

function getApiBase() {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configuredBase) {
    return configuredBase;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname, port } = window.location;
  if (new Set(["localhost", "127.0.0.1"]).has(hostname) && port !== "8000") {
    return `${protocol}//${hostname}:8000`;
  }

  return "";
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { detail: text || "The server returned an empty response." };
}

// ── Medical Reports API Helpers ───────────────────────────────────────────────

export async function getReports(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  });
  const queryString = params.toString();
  return authRequest(`/api/reports${queryString ? `?${queryString}` : ""}`);
}

export async function getReport(reportId) {
  return authRequest(`/api/reports/${reportId}`);
}

export async function submitDoctorReview(reportId, comments, status = "reviewed") {
  return authRequest(`/api/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({
      review_input: { comments, status }
    })
  });
}

export async function archiveReport(reportId, isArchived = true) {
  return authRequest(`/api/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({
      archive_input: { is_archived: isArchived }
    })
  });
}

export async function deleteReport(reportId) {
  return authRequest(`/api/reports/${reportId}`, {
    method: "DELETE",
  });
}

export async function getReportImageUrl(reportId) {
  try {
    const response = await authFetch(`${API_BASE}/api/reports/image/${reportId}`);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error loading secure report image:", error);
    return null;
  }
}


// ── Doctor Reviews & Consultations API Helpers ─────────────────────────────────

export async function requestReview(reportId, doctorId = null) {
  return authRequest("/api/reviews/request", {
    method: "POST",
    body: JSON.stringify({ report_id: reportId, doctor_id: doctorId }),
  });
}

export async function getPatientReviews() {
  return authRequest("/api/reviews/patient");
}

export async function getDoctorReviews(status = "", q = "") {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (q) params.append("q", q);
  const queryString = params.toString();
  return authRequest(`/api/reviews/doctor${queryString ? `?${queryString}` : ""}`);
}

export async function getReviewDetails(reviewId) {
  return authRequest(`/api/reviews/${reviewId}`);
}

export async function submitDoctorReviewData(reviewId, payload) {
  return authRequest(`/api/reviews/${reviewId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateReviewRequestStatus(reviewId, status) {
  return authRequest(`/api/reviews/${reviewId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getAdminReviews(skip = 0, limit = 20) {
  return authRequest(`/api/reviews/admin/all?skip=${skip}&limit=${limit}`);
}

export async function getAdminReviewStats() {
  return authRequest("/api/reviews/admin/stats");
}

export async function getDoctorsList() {
  return authRequest("/api/auth/doctors");
}

// ── Analytics API Helpers ─────────────────────────────────────────────────────

function buildDateQuery(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function getAdminAnalytics(startDate, endDate) {
  return authRequest(`/api/analytics/admin${buildDateQuery(startDate, endDate)}`);
}

export async function getDoctorAnalytics(startDate, endDate) {
  return authRequest(`/api/analytics/doctor${buildDateQuery(startDate, endDate)}`);
}

export async function getPatientAnalytics(startDate, endDate) {
  return authRequest(`/api/analytics/patient${buildDateQuery(startDate, endDate)}`);
}

export async function getDiseaseAnalytics(startDate, endDate) {
  return authRequest(`/api/analytics/diseases${buildDateQuery(startDate, endDate)}`);
}

export async function getTrendAnalytics(startDate, endDate) {
  return authRequest(`/api/analytics/trends${buildDateQuery(startDate, endDate)}`);
}
