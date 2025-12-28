import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc, 
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4utzAzJiMb-R6zxQ3ihGl31mz0_bdR3I",
  authDomain: "mvgrce-permission-portal.firebaseapp.com",
  projectId: "mvgrce-permission-portal",
  storageBucket: "mvgrce-permission-portal.firebasestorage.app",
  messagingSenderId: "122416613856",
  appId: "1:122416613856:web:59007400f4298a73ff4385",
  measurementId: "G-GQDB3D0XXC"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function authenticate(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw "NO_PROFILE";

  const data = snap.data();
  if (!data.approved || data.disabled) throw "ACCESS_DENIED";

  sessionStorage.setItem("uid", uid);
  sessionStorage.setItem("role", data.role);
  sessionStorage.setItem("firstLogin", data.firstLogin ? "true" : "false");
  sessionStorage.setItem("loggedIn", "true");

  return data;
}

export async function markFirstLoginComplete(uid) {
  await updateDoc(doc(db, "users", uid), {
    firstLogin: false,
    updatedAt: serverTimestamp()
  });
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function checkUserExists(email) {
  try {
    console.log('Checking if user exists:', email);
    // Use fetchSignInMethodsForEmail to check if user exists without password
    const methods = await fetchSignInMethodsForEmail(auth, email);
    console.log('Sign-in methods for', email, ':', methods);
    const exists = methods.length > 0;
    console.log('User exists:', exists);
    return exists;
  } catch (error) {
    console.log('Error checking user existence:', error.code, error.message);
    // If there's an error, assume user doesn't exist for safety
    return false;
  }
}

export async function incrementPermissionCount() {
  await setDoc(
    doc(db, "system", "meta"),
    { totalPermissions: increment(1) },
    { merge: true }
  );
}
