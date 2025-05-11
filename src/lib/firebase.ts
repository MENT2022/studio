
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID; // Optional

if (!apiKey || !authDomain || !projectId) {
  console.warn(
    "Firebase configuration is missing or incomplete. " +
    "Please ensure NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID " +
    "are set in your .env.local file."
  );
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
  measurementId: measurementId, 
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Error initializing Firebase services (Firestore/Auth):", error);
  // This indicates a problem with the Firebase config more deeply than just missing keys,
  // or an issue with Firebase SDKs themselves. The 'auth/invalid-api-key'
  // error is usually caught by Firebase internally and thrown during initialization attempts.
}


export { app, db, auth };
