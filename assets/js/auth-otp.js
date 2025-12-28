import { auth, db } from '/assets/js/firebase-init.js';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function sendOTP(email) {
  const actionCodeSettings = {
    url: location.origin + '/public/login.html',
    handleCodeInApp: true
  };

  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  // persist so we can complete sign-in after redirect
  localStorage.setItem('emailForSignIn', email);
}

async function pollForApproval(uid, attempts = 40, interval = 3000) {
  const ref = doc(db, 'users', uid);
  for (let i = 0; i < attempts; i++) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.approved && !data.disabled) return data;
      if (data.disabled) throw new Error('DISABLED');
    }
    await sleep(interval);
  }
  throw new Error('APPROVAL_TIMEOUT');
}

export async function completeOTPSignIn() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;

  let email = sessionStorage.getItem('pendingEmail') || localStorage.getItem('emailForSignIn');
  if (!email) {
    email = window.prompt('Enter the email you used to sign in (for verification)');
    if (!email) throw new Error('NO_EMAIL');
  }

  const cred = await signInWithEmailLink(auth, email, window.location.href);
  const uid = cred.user.uid;

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email,
      approved: false,
      disabled: false,
      firstLogin: true,
      role: 'pending',
      createdAt: serverTimestamp()
    });
  }

  const userData = (await getDoc(ref)).data();
  if (!userData.approved) {
    // wait for admin approval with polling
    try {
      await pollForApproval(uid);
      const final = (await getDoc(ref)).data();
      sessionStorage.setItem('uid', uid);
      sessionStorage.setItem('role', final.role);
      sessionStorage.setItem('firstLogin', final.firstLogin ? 'true' : 'false');
      sessionStorage.setItem('loggedIn', 'true');
      // cleanup
      localStorage.removeItem('emailForSignIn');
      sessionStorage.removeItem('pendingEmail');
      location.replace('/assets/redirect.html');
    } catch (err) {
      if (err.message === 'DISABLED') throw new Error('ACCESS_DENIED');
      throw err;
    }
  } else {
    // already approved
    sessionStorage.setItem('uid', uid);
    sessionStorage.setItem('role', userData.role);
    sessionStorage.setItem('firstLogin', userData.firstLogin ? 'true' : 'false');
    sessionStorage.setItem('loggedIn', 'true');
    localStorage.removeItem('emailForSignIn');
    sessionStorage.removeItem('pendingEmail');
    location.replace('/assets/redirect.html');
  }
}
