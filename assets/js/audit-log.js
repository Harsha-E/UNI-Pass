import { db } from "/assets/js/firebase-init.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function logAction(payload) {
  await addDoc(collection(db, "auditLogs"), {
    actorUid: payload.actorUid,
    actorRole: payload.actorRole,
    action: payload.action,
    target: payload.target || null,
    meta: payload.meta || {},
    at: serverTimestamp()
  });
}

export async function getAuditLogs(filter = {}) {
  let q = collection(db, "auditLogs");

  if (filter.actorUid) {
    q = query(q, where("actorUid", "==", filter.actorUid));
  }

  if (filter.actorRole) {
    q = query(q, where("actorRole", "==", filter.actorRole));
  }

  q = query(q, orderBy("at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
