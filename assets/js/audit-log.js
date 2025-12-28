import { db } from "./firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export async function logAudit(action, meta = {}) {
  await addDoc(collection(db, "auditLogs"), {
    action,
    meta,
    at: serverTimestamp()
  });
}

export async function fetchAuditLogsByPermission(permissionId) {
  const q = query(
    collection(db, "auditLogs"),
    where("meta.permissionId", "==", permissionId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
