
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBHvJ5cFs7nIiKbjxNXEoDU1PqqpE9BzRc",
  authDomain: "mqtt-vue-dashboard.firebaseapp.com",
  // databaseURL: "https://mqtt-vue-dashboard-default-rtdb.firebaseio.com", // Not used for Firestore
  projectId: "mqtt-vue-dashboard",
  storageBucket: "mqtt-vue-dashboard.appspot.com", // Corrected storage bucket format
  messagingSenderId: "1040610750933",
  appId: "1:1040610750933:web:1efd105e6de57e2943cd5c",
  measurementId: "G-PE8J2WY8V6"
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
