import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "./firebase";

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (viteEnv?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type Prediction = "FAKE" | "REAL" | "UNCERTAIN";

type ApiError = {
  detail?: string;
  message?: string;
};

function getCurrentUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  const rawUser = localStorage.getItem("veritasai_user");
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as { email?: string };
    const email = (parsed.email || "").trim().toLowerCase();
    return email || null;
  } catch {
    return null;
  }
}

function withUserHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const nextHeaders = { ...headers };
  const userEmail = getCurrentUserEmail();
  if (userEmail) nextHeaders["X-User-Email"] = userEmail;

  const token = typeof window !== "undefined" ? localStorage.getItem("veritasai_token") : null;
  if (token) nextHeaders.Authorization = `Bearer ${token}`;
  return nextHeaders;
}

export type AuthUser = { name: string; email: string };
export type AuthResponse = { token: string; user: AuthUser };

export type AnalysisResult = {
  prediction: Prediction;
  confidence: number;
  reasons: string[];
  manipulationScore?: number;
  deepfakeScore?: number;
  visualization?: string;
  trustScore?: number;
  domainQualityScore?: number;
  keywordRiskScore?: number;
  shortExplanation?: string;
  badge?: "SAFE" | "NOT_SAFE";
};

export type HistoryItem = {
  id: string;
  type: "text" | "url" | "image" | "video";
  content: string;
  result: Prediction;
  confidence: number;
  timestamp: string;
  reasons?: string[];
  manipulationScore?: number;
  deepfakeScore?: number;
  trustScore?: number;
  domainQualityScore?: number;
  keywordRiskScore?: number;
  shortExplanation?: string;
  badge?: "SAFE" | "NOT_SAFE";
  visualization?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.detail || payload.message || message;
    } catch {
      // Keep the HTTP status when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function isFirebaseIdToken(value: string): boolean {
  return value.split(".").length === 3 && value.startsWith("eyJ");
}

/**
 * Email/password authentication is handled entirely by Firebase Authentication.
 * Render is only used for VeritasAI application APIs after authentication.
 * The JWT-shaped password path exists only for the existing Google flow, whose
 * caller already has a Firebase ID token and should not make a second auth request.
 */
export async function login(payload: {
  email: string;
  password: string;
  remember_me: boolean;
}): Promise<AuthResponse> {
  if (!firebaseAuth) throw new Error("Firebase Authentication is not initialized.");

  if (isFirebaseIdToken(payload.password) && firebaseAuth.currentUser) {
    const user = firebaseAuth.currentUser;
    if (user.email && user.email.toLowerCase() !== payload.email.toLowerCase()) {
      throw new Error("Authenticated Firebase user does not match the requested account.");
    }
    return {
      token: await user.getIdToken(),
      user: {
        name: user.displayName || user.email?.split("@")[0] || "Firebase User",
        email: user.email || payload.email,
      },
    };
  }

  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, payload.email, payload.password);
    const user = credential.user;
    return {
      token: await user.getIdToken(),
      user: {
        name: user.displayName || user.email?.split("@")[0] || "Firebase User",
        email: user.email || payload.email,
      },
    };
  } catch (error) {
    const code = (error as { code?: string })?.code || "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      throw new Error("Invalid email or password.");
    }
    if (code === "auth/too-many-requests") throw new Error("Too many attempts. Please try again later.");
    if (code === "auth/network-request-failed") throw new Error("Unable to reach Firebase Authentication. Check your connection.");
    throw error instanceof Error ? error : new Error("Unable to sign in.");
  }
}

export async function signup(payload: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}): Promise<AuthResponse> {
  if (!firebaseAuth) throw new Error("Firebase Authentication is not initialized.");

  try {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, payload.email, payload.password);
    const user = credential.user;
    if (payload.name.trim()) {
      await updateProfile(user, { displayName: payload.name.trim() });
    }

    return {
      token: await user.getIdToken(),
      user: {
        name: payload.name.trim() || user.email?.split("@")[0] || "Firebase User",
        email: user.email || payload.email,
      },
    };
  } catch (error) {
    const code = (error as { code?: string })?.code || "";
    if (code === "auth/email-already-in-use") throw new Error("An account with this email already exists.");
    if (code === "auth/weak-password") throw new Error("Password is too weak. Please choose a stronger password.");
    if (code === "auth/invalid-email") throw new Error("Please enter a valid email address.");
    if (code === "auth/network-request-failed") throw new Error("Unable to reach Firebase Authentication. Check your connection.");
    throw error instanceof Error ? error : new Error("Unable to create account.");
  }
}

export async function analyzeText(text: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/text`, {
    method: "POST", headers: withUserHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ text }),
  });
  return readResponse<AnalysisResult>(response);
}

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/url`, {
    method: "POST", headers: withUserHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ url }),
  });
  return readResponse<AnalysisResult>(response);
}

export async function analyzeImage(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/analyze/image`, {
    method: "POST", headers: withUserHeaders(), body: formData,
  });
  return readResponse<AnalysisResult>(response);
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/analyze/video`, {
    method: "POST", headers: withUserHeaders(), body: formData,
  });
  return readResponse<AnalysisResult>(response);
}

export async function analyzeVideoUrl(url: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/video-url`, {
    method: "POST", headers: withUserHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ url }),
  });
  return readResponse<AnalysisResult>(response);
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/history`, { headers: withUserHeaders() });
  return readResponse<HistoryItem[]>(response);
}
