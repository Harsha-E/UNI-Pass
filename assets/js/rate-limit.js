import { db } from "/assets/js/firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const WINDOW = 60 * 1000;
const MAX = 10;

export async function allowAction(uid, action) {
  const ref = doc(db, "rateLimits", `${uid}_${action}`);
  const snap = await getDoc(ref);

  const now = Date.now();

  if (!snap.exists()) {
    await setDoc(ref, {
      count: 1,
      windowStart: now,
      updatedAt: serverTimestamp()
    });
    return true;
  }

  const d = snap.data();

  if (now - d.windowStart > WINDOW) {
    await setDoc(ref, {
      count: 1,
      windowStart: now,
      updatedAt: serverTimestamp()
    });
    return true;
  }

  if (d.count >= MAX) return false;

  await setDoc(ref, {
    count: d.count + 1,
    windowStart: d.windowStart,
    updatedAt: serverTimestamp()
  });

  return true;
}
