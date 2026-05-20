import { initializeApp, getApps } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const storage = getStorage(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);

// Sign in anonymously so all client-side Firestore calls carry a valid auth token.
// Firestore rules must allow authenticated requests: `allow read, write: if request.auth != null;`
// Requires Anonymous Authentication to be enabled in Firebase Console → Authentication → Sign-in method.
export const authReady: Promise<void> =
  typeof window !== "undefined"
    ? signInAnonymously(firebaseAuth)
        .then(() => undefined)
        .catch((err) => {
          console.error(
            "[Firebase] Anonymous sign-in failed — Firestore calls will be rejected.\n" +
            "Fix: enable Anonymous Authentication in the Firebase Console → Authentication → Sign-in method.\n",
            err
          );
        })
    : Promise.resolve();
