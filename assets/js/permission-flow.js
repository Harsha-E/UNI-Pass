import { db } from "/assets/js/firebase-init.js";
import {
 collection, doc, setDoc, updateDoc,
 getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===== HASH GENERATOR ===== */
export function generateHash(){
 return "UP-" + Math.random().toString(36).substring(2,10).toUpperCase();
}

/* ===== STUDENT: CREATE REQUEST ===== */
export async function createRequest(toUid, reason){
 const uid = sessionStorage.getItem("uid");
 const hash = generateHash();

 await setDoc(doc(db,"permissionRequests",hash),{
   fromUid: uid,
   toUid,
   roleFrom: "student",
   roleTo: "teacher",
   reason,
   status: "pending",
   hash,
   createdAt: serverTimestamp()
 });

 return hash;
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
