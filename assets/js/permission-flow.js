import { db } from "/assets/js/firebase-init.js";
import {
 collection, doc, setDoc, updateDoc,
 getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===== CRYPTOGRAPHIC HASH GENERATOR ===== */
export async function generateHash(payload = {}){
  const seed = JSON.stringify(payload) + '::' + Date.now();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return hex; // full hex (64 chars)
}

/* ===== STUDENT: CREATE REQUEST ===== */
export async function createRequest(toUid, reason){
  const uid = sessionStorage.getItem("uid");
  if (!uid) throw new Error("User not authenticated");
  
  if (!toUid || !reason) throw new Error("Missing required fields");
  
  const payload = { fromUid: uid, toUid, roleFrom: 'student', roleTo: 'teacher', reason };
  const fullHex = await generateHash(payload);
  const shortId = 'UP-' + fullHex.substring(0,16).toUpperCase();

  try {
    await setDoc(doc(db,"permissionRequests",shortId),{
      fromUid: uid,
      toUid,
      roleFrom: "student",
      roleTo: "teacher",
      reason,
      status: "pending",
      hash: shortId,
      permissionHashFull: fullHex,
      createdAt: serverTimestamp()
    });
    return shortId;
  } catch (error) {
    console.error("Failed to create permission request:", error);
    throw new Error("Failed to submit permission request");
  }
}

/* ===== TEACHER / HOD: UPDATE STATUS ===== */
export async function updateRequest(hash, status, nextRole){
 const ref = doc(db,"permissionRequests",hash);

 const update = { status };
 if(nextRole === "hod"){
   update.roleTo = "hod";
 }

 await updateDoc(ref, update);
}

/* ===== FETCH REQUESTS FOR USER ===== */
export async function getRequestsForRole(role){
 const uid = sessionStorage.getItem("uid");

 const q = query(
   collection(db,"permissionRequests"),
   where("roleTo","==",role),
   where("toUid","==",uid)
 );

 const snap = await getDocs(q);
 return snap.docs.map(d=>d.data());
}

/* ===== CHECKER LOOKUP ===== */
export async function checkPermission(hash){
 const q = query(
   collection(db,"permissionRequests"),
   where("hash","==",hash),
   where("status","==","approved")
 );

 const snap = await getDocs(q);
 return !snap.empty;
}
