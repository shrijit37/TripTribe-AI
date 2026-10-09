
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};


// Defensive init: without VITE_FIREBASE_* keys (see .env.example) the app
// must still boot — only email signup fails at request time with a clear
// error. initializeApp with an empty config throws and would kill the
// whole SPA through the static import chain (Navbar -> Signup -> here).
let auth = null;
try {
  if (!firebaseConfig.apiKey) throw new Error("firebase not configured");
  auth = getAuth(initializeApp(firebaseConfig));
} catch (e) {
  console.warn("Firebase disabled:", e.message);
}

export default auth;