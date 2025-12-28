import { auth, db } from './firebase-init.js';

// List of protected folders and who can access them
const PROTECTED_PATHS = {
    '/portals/teacher/': 'teacher',
    '/portals/hod/': 'hod',
    '/admin/': 'admin'
};

auth.onAuthStateChanged(async (user) => {
    const currentPath = window.location.pathname;

    // 1. If not logged in, kick to login page
    if (!user && !currentPath.includes('login.html') && !currentPath.includes('checker.html')) {
        window.location.href = '/public/login.html';
        return;
    }

    // 2. If logged in, check if they are allowed in this folder
    if (user) {
        // Find which folder we are in
        const matchedPath = Object.keys(PROTECTED_PATHS).find(path => currentPath.includes(path));
        
        if (matchedPath) {
            const requiredRole = PROTECTED_PATHS[matchedPath];
            
            // Check DB for real role
            const userDoc = await db.collection('users').doc(user.uid).get();
            const realRole = userDoc.data().role;

            if (realRole !== requiredRole) {
                alert(`SECURITY ALERT: Access Denied.\nYou are a ${realRole}, but this page is for ${requiredRole}s.`);
                window.location.href = '/public/login.html'; // Kick them out
            }
        }
    }
});