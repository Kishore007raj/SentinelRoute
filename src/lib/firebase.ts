/**
 * firebase.ts — Firebase app, Auth, and Firestore initialisation.
 *
 * Reads NEXT_PUBLIC_ env vars directly from process.env.
 * Safe to import on both client and server — initialization is
 * skipped when the API key is absent (e.g. during SSR of public pages).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (apiKey) {
  const firebaseConfig = {
    apiKey,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db   = getFirestore(app);
} else {
  // Stub values during SSR when env vars aren't available
  app  = {} as FirebaseApp;
  auth = {} as Auth;
  db   = {} as Firestore;

  if (typeof window !== "undefined") {
    console.warn(
      "[firebase] NEXT_PUBLIC_FIREBASE_API_KEY is not set.\n" +
      "Fill in .env.local and restart the dev server."
    );
  }
}

export { auth, db };
export default app;
