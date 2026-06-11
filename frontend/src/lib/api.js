export const MODEL_NAME = "ensemble";
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

export async function analyzeSkinImage(imageFile) {
  const formData = new FormData();
  formData.append("file", imageFile);

  try {
    const response = await authFetch(`${API_BASE}/api/predict?model=${MODEL_NAME}`, {
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
