import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, type UserCredential, setPersistence, browserLocalPersistence } from "firebase/auth";
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
let firebaseAuth: any = null;
let googleAuthProvider: GoogleAuthProvider | null = null;
let firebaseInitError: string | null = null;
let firebaseReady = false;

try {
  firebaseApp = initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
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

export { firebaseApp, firestoreDb, firebaseAuth, googleAuthProvider };

export async function signInWithGooglePopup(): Promise<UserCredential> {
  if (!firebaseReady || !firebaseAuth || !googleAuthProvider) {
    throw new Error(
      "Google authentication is temporarily unavailable. Please use email/password signup instead. " +
      (firebaseInitError ? `(${firebaseInitError})` : "")
    );
  }

  // Add timeout for Google popup (10 seconds - Firebase needs this)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      reject(new Error("Google sign-in request timed out"));
    }, 10000)
  );

  try {
    return await Promise.race([signInWithPopup(firebaseAuth, googleAuthProvider), timeoutPromise]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Google sign-in failed";
    
    // Network timeout or DNS resolution failure
    if (errorMsg.includes("timed out") || errorMsg.includes("timeout") || errorMsg.includes("ERR_NAME_NOT_RESOLVED") || errorMsg.includes("ENOTFOUND")) {
      throw new Error(
        "Google sign-in timed out. This is a temporary issue with Google's servers or your network. Please try email/password signup instead."
      );
    }
    
    // CORS or browser blocking
    if (errorMsg.includes("CORS") || errorMsg.includes("blocked") || errorMsg.includes("origin not allowed")) {
      throw new Error("Browser or network blocked Google sign-in. Please try email/password signup instead.");
    }
    
    // Popup blocked
    if (errorMsg.includes("popup")) {
      throw new Error("Google sign-in popup was blocked. Please allow popups and try again.");
    }
    
    // Firebase configuration issue
    if (errorMsg.includes("Invalid API Key") || errorMsg.includes("API key not valid")) {
      throw new Error("Firebase configuration issue. Please contact support.");
    }
    
    // Network connectivity issue
    if (errorMsg.includes("NetworkError") || errorMsg.includes("Failed to fetch") || errorMsg.includes("net::ERR")) {
      throw new Error(
        "Network error connecting to Google. Please check your internet connection and try again."
      );
    }
    
    throw err;
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
