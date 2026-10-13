const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL) || "http://localhost:8000/api/v1";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: Record<string, any>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach stored JWT access token if present
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("campyteq_access_token") || localStorage.getItem("campus360_access_token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Attach active college context header if selected (for Super Admins)
    const activeCollegeId = localStorage.getItem("campyteq_active_college_id") || localStorage.getItem("campus360_active_college_id");
    if (activeCollegeId && !headers["X-College-ID"]) {
      headers["X-College-ID"] = activeCollegeId;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    // Check if token expired (401) and try refresh if possible
    if (response.status === 401 && typeof window !== "undefined") {
      const refreshToken = localStorage.getItem("campyteq_refresh_token") || localStorage.getItem("campus360_refresh_token");
      if (refreshToken && !endpoint.includes("/auth/token/refresh/")) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem("campyteq_access_token", refreshData.access);
            // Retry original request with fresh token
            headers["Authorization"] = `Bearer ${refreshData.access}`;
            const retryRes = await fetch(url, { ...options, headers });
            return retryRes.json();
          } else {
            // Token refresh failed - clean storage
            localStorage.removeItem("campyteq_access_token");
            localStorage.removeItem("campyteq_refresh_token");
            localStorage.removeItem("campyteq_user");
            localStorage.removeItem("campus360_access_token");
            localStorage.removeItem("campus360_refresh_token");
            localStorage.removeItem("campus360_user");
          }
        } catch {
          // ignore
        }
      }
    }

    const errorMessage = data?.message || data?.detail || "An unexpected error occurred.";
    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.code || "API_ERROR";
    error.errors = data?.errors || {};
    throw error;
  }

  // If response wraps data in 'data' field, return directly or return payload
  return data?.data !== undefined ? data.data : data;
}
