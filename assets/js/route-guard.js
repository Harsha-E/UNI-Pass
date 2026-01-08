import { auth, db } from './firebase-init.js';

const PROTECTED_PATHS = {
    '/portals/teacher/': 'teacher',
    '/portals/hod/': 'hod',
    '/portals/student/': 'student',
    '/portals/lab-assistant/': 'lab_assistant', // <--- ADDED NEW PATH
    '/admin/': 'admin'
};

// --- LOGOUT HELPER ---
async function forceLogout(reason) {
    console.warn(`Security Alert: ${reason}`);
    alert(`Access Denied: ${reason}`);
    sessionStorage.clear();
    localStorage.clear();
    await auth.signOut();
    window.location.href = '/public/login.html';
}

// --- ACCESS CHECKER ---
async function verifyAccess(user) {
    const currentPath = window.location.pathname;
    
    // 1. Identify Target Role for this Path
    const matchedPath = Object.keys(PROTECTED_PATHS).find(path => currentPath.includes(path));
    if (!matchedPath) return; // Not a protected path (e.g., public profile)

    const requiredRole = PROTECTED_PATHS[matchedPath];

    // 2. Fetch LIVE User Profile
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        
        if (!doc.exists) {
            await forceLogout("User profile not found. Please contact IT.");
            return;
        }

        const data = doc.data();
        const dbRole = data.role;
        const isBlocked = data.isBlocked || false;

        // 3. Security Checks
        
        // CHECK A: Account Blocking
        if (isBlocked) {
            await forceLogout("Your account has been BLOCKED by the Administrator.");
            return;
        }

        // CHECK B: Role Mismatch
        if (dbRole !== requiredRole) {
            if (dbRole !== 'admin') { 
                await forceLogout(`Unauthorized. You are a ${dbRole.toUpperCase()}, not a ${requiredRole.toUpperCase()}.`);
                return;
            }
        }

        // 4. Update Session Storage (Sync with DB)
        sessionStorage.setItem('uni_pass_role', dbRole);

    } catch (error) {
        console.error("Route Guard Error:", error);
    }
}

// --- MAIN LISTENER ---
auth.onAuthStateChanged(async (user) => {
    const currentPath = window.location.pathname;
    const isPublic = currentPath.includes('login.html') || 
                     currentPath.includes('signup.html') || 
                     currentPath.includes('checker.html') ||
                     currentPath.includes('lab-resources.html');

    // 1. No User on Protected Page -> Kick
    if (!user && !isPublic) {
        window.location.href = '/public/login.html';
        return;
    }

    // 2. User Logged In -> Verify Logic
    if (user) {
        // Redirect from Login Page if already logged in
        if (currentPath.includes('login.html') || currentPath.includes('signup.html')) {
            const cachedRole = sessionStorage.getItem('uni_pass_role');
            
            // SPECIFIC REDIRECT FOR LAB ASSISTANT
            if (cachedRole === 'lab_assistant') {
                window.location.href = '/portals/lab-assistant/dashboard.html';
                return;
            }

            // GENERIC REDIRECT FOR OTHERS
            if (cachedRole && PROTECTED_PATHS[`/portals/${cachedRole}/`]) {
                window.location.href = `/portals/${cachedRole}/portalA.html`;
            }
            return;
        }

        // Perform Deep Verification
        await verifyAccess(user);
    }
});