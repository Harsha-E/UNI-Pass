import { db } from "/assets/js/firebase-init.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function createPermission(payload) {
  const ref = await addDoc(collection(db, "permissions"), {
    ownerUid: payload.ownerUid,
    scope: payload.scope,
    validFrom: payload.validFrom,
    validTill: payload.validTill,
    createdAt: serverTimestamp(),
    sealed: false
  });

  await addDoc(collection(db, "permissionEvents"), {
    permissionId: ref.id,
    type: "REQUESTED",
    actorUid: payload.ownerUid,
    actorRole: "student",
    data: payload.data,
    at: serverTimestamp()
  });

  return ref.id;
}

export async function recommendPermission(permissionId, teacherUid, note) {
  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: "RECOMMENDED",
    actorUid: teacherUid,
    actorRole: "teacher",
    data: { note },
    at: serverTimestamp()
  });
}

export async function authorizePermission(permissionId, hodUid) {
  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: "AUTHORIZED",
    actorUid: hodUid,
    actorRole: "hod",
    data: {},
    at: serverTimestamp()
  });

  await updateDoc(doc(db, "permissions", permissionId), {
    sealed: true,
    authorizedAt: serverTimestamp()
  });
}

export async function rejectPermission(permissionId, uid, role, reason) {
  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: "REJECTED",
    actorUid: uid,
    actorRole: role,
    data: { reason },
    at: serverTimestamp()
  });
}

export async function revokePermission(permissionId, adminUid, reason) {
  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: "REVOKED",
    actorUid: adminUid,
    actorRole: "admin",
    data: { reason },
    at: serverTimestamp()
  });

  await updateDoc(doc(db, "permissions", permissionId), {
    sealed: false,
    revokedAt: serverTimestamp()
  });
}

export async function getPermissionTimeline(permissionId) {
  const q = query(
    collection(db, "permissionEvents"),
    where("permissionId", "==", permissionId),
    orderBy("at", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function isPermissionValid(permissionId, atTime = Date.now()) {
  const p = await getDoc(doc(db, "permissions", permissionId));
  if (!p.exists()) return false;

  const d = p.data();
  if (!d.sealed) return false;
  if (new Date(d.validFrom).getTime() > atTime) return false;
  if (new Date(d.validTill).getTime() < atTime) return false;

  const q = query(
    collection(db, "permissionEvents"),
    where("permissionId", "==", permissionId),
    where("type", "==", "REVOKED")
  );
  const r = await getDocs(q);
  return r.empty;
}

export async function getUserPermissions(uid) {
  const q = query(
    collection(db, "permissions"),
    where("ownerUid", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingForRole(roleUid, role) {
  const q = query(
    collection(db, "permissionEvents"),
    where("type", "==", role === "teacher" ? "REQUESTED" : "RECOMMENDED")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
