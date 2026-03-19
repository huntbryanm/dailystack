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

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBx-0_s-T1znSA-afgpz0oygBgmbruzs6U",
    authDomain: "dailystack-2dfcd.firebaseapp.com",
    projectId: "dailystack-2dfcd",
    storageBucket: "dailystack-2dfcd.firebasestorage.app",
    messagingSenderId: "187833837980",
    appId: "1:187833837980:web:f84a4813b0c83dac5cc059",
    measurementId: "G-7QVBZ387G3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "YOUR_APP_ID",
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
