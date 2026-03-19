import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, type UserCredential } from "firebase/auth";

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

const firebaseConfig = {
  apiKey: viteEnv?.VITE_FIREBASE_API_KEY || "AIzaSyBRdVGqovt2oZrxfqhLdefsy_v3r1LVXTE",
  authDomain: viteEnv?.VITE_FIREBASE_AUTH_DOMAIN || "veritasai-6e4ac.firebaseapp.com",
  projectId: viteEnv?.VITE_FIREBASE_PROJECT_ID || "veritasai-6e4ac",
  storageBucket: viteEnv?.VITE_FIREBASE_STORAGE_BUCKET || "veritasai-6e4ac.firebasestorage.app",
  messagingSenderId: viteEnv?.VITE_FIREBASE_MESSAGING_SENDER_ID || "634027149151",
  appId: viteEnv?.VITE_FIREBASE_APP_ID || "1:634027149151:web:620c795ee8552c189698ea",
  measurementId: viteEnv?.VITE_FIREBASE_MEASUREMENT_ID || "G-0KRJDDP1J4",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGooglePopup(): Promise<UserCredential> {
  return signInWithPopup(firebaseAuth, googleAuthProvider);
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
