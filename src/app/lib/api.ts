const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (viteEnv?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type Prediction = "FAKE" | "REAL";

type ApiError = {
  detail?: string;
  message?: string;
};

export type AuthUser = {
  name: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type AnalysisResult = {
  prediction: Prediction;
  confidence: number;
  reasons: string[];
  manipulationScore?: number;
  deepfakeScore?: number;
};

export type HistoryItem = {
  id: string;
  type: "text" | "url" | "image" | "video";
  content: string;
  result: Prediction;
  confidence: number;
  timestamp: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as ApiError;
      message = payload.detail || payload.message || message;
    } catch {
      // Ignore JSON parsing errors and keep generic status message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function login(payload: {
  email: string;
  password: string;
  remember_me: boolean;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readResponse<AuthResponse>(response);
}

export async function signup(payload: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readResponse<AuthResponse>(response);
}

export async function analyzeText(text: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  return readResponse<AnalysisResult>(response);
}

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  return readResponse<AnalysisResult>(response);
}

export async function analyzeImage(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/analyze/image`, {
    method: "POST",
    body: formData,
  });

  return readResponse<AnalysisResult>(response);
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/analyze/video`, {
    method: "POST",
    body: formData,
  });

  return readResponse<AnalysisResult>(response);
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/history`);
  return readResponse<HistoryItem[]>(response);
}
