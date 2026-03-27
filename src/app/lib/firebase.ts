import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { firebaseConfig as defaultConfig } from "./firebaseConfig";

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

const firebaseConfig = {
  apiKey: viteEnv?.VITE_FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain: viteEnv?.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  databaseURL: viteEnv?.VITE_FIREBASE_DATABASE_URL || defaultConfig.databaseURL,
  projectId: viteEnv?.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: viteEnv?.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: viteEnv?.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: viteEnv?.VITE_FIREBASE_APP_ID || defaultConfig.appId,
  measurementId: viteEnv?.VITE_FIREBASE_MEASUREMENT_ID || defaultConfig.measurementId,
};

let firebaseApp: any = null;
let firestoreDb: any = null;
let firebaseStorage: any = null;
let firebaseAuth: any = null;
let googleAuthProvider: GoogleAuthProvider | null = null;
let firebaseInitError: string | null = null;
let firebaseReady = false;

try {
  firebaseApp = initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
  firebaseStorage = getStorage(firebaseApp);
  firebaseAuth = getAuth(firebaseApp);

  // Set persistence to LOCAL
  if (firebaseAuth) {
    setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
      console.warn("Firebase persistence setup warning:", err);
    });
  }

  googleAuthProvider = new GoogleAuthProvider();
  googleAuthProvider.setCustomParameters({ prompt: "select_account" });

  firebaseReady = true;
  console.log("Firebase initialized successfully");
} catch (err) {
  firebaseInitError = err instanceof Error ? err.message : "Firebase initialization failed";
  console.error("Firebase initialization error:", firebaseInitError);
  firebaseReady = false;
}

export { firebaseApp, firestoreDb, firebaseStorage, firebaseAuth, googleAuthProvider };

type GoogleAuthErrorInfo = {
  code: string;
  message: string;
};

function getGoogleAuthErrorInfo(err: unknown): GoogleAuthErrorInfo {
  const raw = err as { code?: string; message?: string } | undefined;
  return {
    code: raw?.code || "",
    message: raw?.message || "",
  };
}

function mapGoogleAuthError(err: unknown): Error {
  const details = getGoogleAuthErrorInfo(err);
  const errorMsg = details.message;
  const errorCode = details.code;

  if (
    errorCode === "auth/unauthorized-domain" ||
    errorMsg.includes("unauthorized-domain") ||
    errorMsg.includes("origin not allowed")
  ) {
    return new Error(
      "Google sign-in is blocked for this domain. In Firebase Console, add localhost and 127.0.0.1 to Authorized domains under Authentication settings."
    );
  }

  if (errorCode === "auth/popup-blocked" || errorMsg.includes("popup")) {
    return new Error("Google sign-in popup was blocked. Please allow popups and try again.");
  }

  if (
    errorMsg.includes("ERR_NAME_NOT_RESOLVED") ||
    errorMsg.includes("ENOTFOUND") ||
    errorCode === "auth/network-request-failed"
  ) {
    return new Error(
      "Google sign-in could not reach Google's servers. Please check your internet/firewall and try again."
    );
  }

  if (errorMsg.includes("Invalid API Key") || errorMsg.includes("API key not valid")) {
    return new Error("Firebase configuration issue. Please contact support.");
  }

  if (errorMsg.includes("NetworkError") || errorMsg.includes("Failed to fetch") || errorMsg.includes("net::ERR")) {
    return new Error("Network error connecting to Google. Please check your internet connection and try again.");
  }

  return err instanceof Error ? err : new Error("Google sign-in failed");
}

function shouldFallbackToRedirect(err: unknown): boolean {
  const details = getGoogleAuthErrorInfo(err);
  const combined = `${details.code} ${details.message}`.toLowerCase();

  return (
    combined.includes("popup-blocked") ||
    combined.includes("operation-not-supported-in-this-environment") ||
    combined.includes("web-storage-unsupported") ||
    combined.includes("chrome-error://chromewebdata")
  );
}

async function assertFirebaseAuthReachable(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const authHost = firebaseConfig.authDomain;
  if (!authHost) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // no-cors allows connectivity probing without requiring CORS headers.
    await fetch(`https://${authHost}/__/auth/handler`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      "Cannot reach Firebase Auth domain from your network. Please allow these domains in firewall/proxy: *.firebaseapp.com, *.web.app, accounts.google.com, identitytoolkit.googleapis.com, securetoken.googleapis.com."
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function executePopupSignIn(): Promise<UserCredential> {
  if (!firebaseReady || !firebaseAuth || !googleAuthProvider) {
    throw new Error(
      "Google authentication is temporarily unavailable. Please use email/password signup instead. " +
        (firebaseInitError ? `(${firebaseInitError})` : "")
    );
  }

  // Rely on Firebase SDK errors instead of an artificial local timeout that can fire too early.
  return signInWithPopup(firebaseAuth, googleAuthProvider);
}

export async function signInWithGooglePopup(): Promise<UserCredential> {
  try {
    return await executePopupSignIn();
  } catch (err) {
    throw mapGoogleAuthError(err);
  }
}

export async function signInWithGoogle(): Promise<UserCredential | null> {
  if (!firebaseReady || !firebaseAuth || !googleAuthProvider) {
    throw new Error(
      "Google authentication is temporarily unavailable. Please use email/password signup instead. " +
        (firebaseInitError ? `(${firebaseInitError})` : "")
    );
  }

  await assertFirebaseAuthReachable();

  try {
    return await executePopupSignIn();
  } catch (err) {
    const forceRedirectOnly = viteEnv?.VITE_GOOGLE_AUTH_REDIRECT_ONLY === "true";
    if (shouldFallbackToRedirect(err) || forceRedirectOnly) {
      await signInWithRedirect(firebaseAuth, googleAuthProvider);
      return null;
    }

    throw mapGoogleAuthError(err);
  }
}

export async function consumeGoogleRedirectResult(): Promise<UserCredential | null> {
  if (!firebaseReady || !firebaseAuth) {
    return null;
  }

  try {
    return await getRedirectResult(firebaseAuth);
  } catch (err) {
    throw mapGoogleAuthError(err);
  }
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const analyticsSupported = await isSupported();
    if (!analyticsSupported) {
      return null;
    }

    return getAnalytics(firebaseApp);
  } catch {
    return null;
  }
}
