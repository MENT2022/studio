
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database"; // Added for Realtime Database
// import { getAnalytics } from "firebase/analytics"; // Analytics not used in current setup

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBHvJ5cFs7nIiKbjxNXEoDU1PqqpE9BzRc", // Make sure this is the correct and active key
  authDomain: "mqtt-vue-dashboard.firebaseapp.com",
  databaseURL: "https://mqtt-vue-dashboard-default-rtdb.firebaseio.com", // Added for Realtime Database
  projectId: "mqtt-vue-dashboard",
  storageBucket: "mqtt-vue-dashboard.appspot.com", // Corrected, was .firebasestorage.app
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

// const analytics = getAnalytics(app); // Analytics not used in current setup

let firestoreDB: Firestore | null = null;
let auth: Auth | null = null;
let rtdb: Database | null = null; // Realtime Database instance

try {
  firestoreDB = getFirestore(app); // Keep Firestore init if other parts of app might use it or for general_log
  auth = getAuth(app);
  rtdb = getDatabase(app); // Initialize Realtime Database
} catch (error) {
  console.error("Error initializing Firebase services (Firestore/Auth/RealtimeDatabase):", error);
}

export { app, firestoreDB, auth, rtdb }; // Export rtdb
