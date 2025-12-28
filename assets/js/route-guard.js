import { auth, db } from './firebase-init.js';

const PROTECTED_PATHS = {
    '/portals/teacher/': 'teacher',
    '/portals/hod/': 'hod',
    '/portals/student/': 'student',
    '/admin/': 'admin'
};

function checkAccess(role) {
    const currentPath = window.location.pathname;
    const matchedPath = Object.keys(PROTECTED_PATHS).find(path => currentPath.includes(path));

    if (matchedPath) {
        const requiredRole = PROTECTED_PATHS[matchedPath];
        
        if (role !== requiredRole) {
            console.warn(`Role Mismatch: User is ${role}, Path needs ${requiredRole}`);
            
            // AUTOMATIC FIX: Clear session and boot to login
            alert(`Access Denied.\n\nYou are logged in as a ${role.toUpperCase()}.\nThis area is for ${requiredRole.toUpperCase()}s.`);
            
            sessionStorage.clear();
            auth.signOut().then(() => {
                window.location.href = '/public/login.html';
            });
            return false;
        }
    }
    return true;
}

auth.onAuthStateChanged(async (user) => {
    const currentPath = window.location.pathname;
    const isPublic = currentPath.includes('login.html') || currentPath.includes('signup.html') || currentPath.includes('checker.html');

    if (!user && !isPublic) {
        window.location.href = '/public/login.html';
        return;
    }

    if (user && !isPublic) {
        // 1. Check Session Storage First (Faster)
        const cachedRole = sessionStorage.getItem('uni_pass_role');
        if (cachedRole) {
            checkAccess(cachedRole);
        } else {
            // 2. Fallback to DB (Slower but reliable)
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                const role = doc.data().role;
                sessionStorage.setItem('uni_pass_role', role); // Cache it
                checkAccess(role);
            }
        }
    }
});