import "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";
import "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";

const firebase = window.firebase;

const firebaseConfig = {
  apiKey: "AIzaSyB4utzAzJiMb-R6zxQ3ihGl31mz0_bdR3I",
  authDomain: "mvgrce-permission-portal.firebaseapp.com",
  projectId: "mvgrce-permission-portal",
  storageBucket: "mvgrce-permission-portal.firebasestorage.app",
  messagingSenderId: "122416613856",
  appId: "1:122416613856:web:59007400f4298a73ff4385",
  measurementId: "G-GQDB3D0XXC"
};
// 3. Initialize
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

const db = firebase.firestore();
const auth = firebase.auth();

console.log("🔥 UNI-PASS Module Connected");

export { db, auth };