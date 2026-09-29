import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { AppState } from './types';

export interface FirebaseServices {
  auth: Auth;
  db: Firestore;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function createFirebaseServices(): FirebaseServices | null {
  const requiredValues = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.appId,
  ];

  const hasRequiredConfig = requiredValues.every(value => {
    if (typeof value !== 'string') return false;
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 && !trimmedValue.startsWith('YOUR_') && !trimmedValue.includes('example');
  });

  if (!hasRequiredConfig) return null;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function observeAuth(services: FirebaseServices, callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(services.auth, callback);
}

export async function fetchUserState(services: FirebaseServices, uid: string): Promise<AppState | null> {
  const snapshot = await getDoc(doc(services.db, 'users', uid));
  return snapshot.exists() ? snapshot.data() as AppState : null;
}

export async function persistUserState(services: FirebaseServices, uid: string, state: AppState): Promise<void> {
  await setDoc(doc(services.db, 'users', uid), { ...state, updatedAt: serverTimestamp() }, { merge: true });
}

export async function signInWithGoogle(services: FirebaseServices): Promise<void> {
  await signInWithPopup(services.auth, new GoogleAuthProvider());
}

export async function signInWithEmail(services: FirebaseServices, email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(services.auth, email, password);
}

export async function createEmailAccount(services: FirebaseServices, email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(services.auth, email, password);
}

export async function sendPasswordReset(services: FirebaseServices, email: string): Promise<void> {
  await sendPasswordResetEmail(services.auth, email);
}

export async function signOutUser(services: FirebaseServices): Promise<void> {
  await signOut(services.auth);
}