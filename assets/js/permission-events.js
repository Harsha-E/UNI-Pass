import { db } from "./firebase-init.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

async function getReasonRule(reasonId) {
  const ref = doc(db, "permissionRules", "reasons", reasonId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Invalid reason");
  return snap.data();
}

export async function createPermission({
  student,
  reasonId,
  customReasonText = null,
  validity = {}
}) {
  const rule = await getReasonRule(reasonId);

  const ref = await addDoc(collection(db, "permissions"), {
    student,
    reason: {
      id: reasonId,
      label: rule.label,
      isCustom: !!rule.isCustom,
      customText: customReasonText
    },
    approvalType: rule.approvalType,
    status: {
      teacher: "pending",
      hod: rule.approvalType === "TEACHER_ONLY" ? "not_required" : "pending",
      final: "pending"
    },
    approvals: {
      teacher: null,
      hod: null
    },
    validity,
    hash: null,
    pdf: {
      generated: false,
      generatedAt: null,
      url: null
    },
    createdAt: serverTimestamp()
  });

  await addDoc(collection(db, "permissionEvents"), {
    permissionId: ref.id,
    type: "REQUESTED",
    actorRole: "STUDENT",
    actor: { uid: student.uid, email: student.email },
    at: serverTimestamp()
  });

  return ref.id;
}

export async function teacherDecision(permissionId, teacher, decision) {
  const ref = doc(db, "permissions", permissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.status.teacher !== "pending") return;

  await updateDoc(ref, {
    "status.teacher": decision,
    "status.final":
      decision === "rejected"
        ? "rejected"
        : data.approvalType === "TEACHER_ONLY"
        ? "approved"
        : "pending",
    "approvals.teacher": {
      uid: teacher.uid,
      name: teacher.name,
      email: teacher.email,
      approvedAt: serverTimestamp()
    }
  });

  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: decision === "approved" ? "TEACHER_APPROVED" : "TEACHER_REJECTED",
    actorRole: "TEACHER",
    actor: { uid: teacher.uid, email: teacher.email },
    at: serverTimestamp()
  });
}

export async function hodDecision(permissionId, hod, decision) {
  const ref = doc(db, "permissions", permissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.approvalType !== "TEACHER_HOD") return;
  if (data.status.teacher !== "approved") return;
  if (data.status.hod !== "pending") return;

  await updateDoc(ref, {
    "status.hod": decision,
    "status.final": decision,
    "approvals.hod": {
      uid: hod.uid,
      name: hod.name,
      email: hod.email,
      approvedAt: serverTimestamp()
    }
  });

  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: decision === "approved" ? "HOD_APPROVED" : "HOD_REJECTED",
    actorRole: "HOD",
    actor: { uid: hod.uid, email: hod.email },
    at: serverTimestamp()
  });
}

export async function markPdfGenerated(permissionId, pdfUrl) {
  const ref = doc(db, "permissions", permissionId);
  await updateDoc(ref, {
    "pdf.generated": true,
    "pdf.generatedAt": serverTimestamp(),
    "pdf.url": pdfUrl
  });

  await addDoc(collection(db, "permissionEvents"), {
    permissionId,
    type: "PDF_GENERATED",
    actorRole: "SYSTEM",
    at: serverTimestamp()
  });
}

export async function fetchStudentPermissions(studentUid) {
  const q = query(
    collection(db, "permissions"),
    where("student.uid", "==", studentUid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchTeacherPermissions() {
  const snap = await getDocs(collection(db, "permissions"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.status.teacher === "pending");
}

export async function fetchHodPermissions() {
  const snap = await getDocs(collection(db, "permissions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchApprovedPermissionByHash(hash) {
  const q = query(
    collection(db, "permissions"),
    where("hash.short", "==", hash),
    where("status.final", "==", "approved")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function fetchPermissionTimeline(permissionId) {
  const q = query(
    collection(db, "permissionEvents"),
    where("permissionId", "==", permissionId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
