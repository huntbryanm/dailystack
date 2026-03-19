import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "PASTE_YOURS",
  authDomain: "PASTE_YOURS",
  projectId: "PASTE_YOURS",
  storageBucket: "PASTE_YOURS",
  messagingSenderId: "PASTE_YOURS",
  appId: "PASTE_YOURS",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export { onAuthStateChanged };

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export async function loadUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserData(uid, data) {
  await setDoc(
    doc(db, "users", uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function initializeUser(uid, email) {
  const existing = await loadUserData(uid);
  if (!existing) {
    const blank = {
      email,
      habits: [],
      habitChecks: {},
      tasks: {},
      isPro: false,
      licenseKey: null,
      createdAt: serverTimestamp(),
    };
    await saveUserData(uid, blank);
    return blank;
  }
  return existing;
}