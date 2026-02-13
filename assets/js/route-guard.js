import { auth, db } from './firebase-init.js';

// Pages that don't require login
const PUBLIC_PAGES = [
    'login.html', 
    'signup.html', 
    'index.html', 
    'unauthorized.html', 
    'reset-password.html', 
    'error-404.html',
    'checker.html',
    'alumni-chatbot.html'
];

auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname;
    const page = path.split('/').pop();

    // 1. REDIRECT TO LOGIN if not authenticated on a private page
    if (!user && !PUBLIC_PAGES.includes(page)) {
        // Dynamic path adjustment based on folder depth
        const depth = path.split('/').length - 2;
        const prefix = depth === 1 ? '../' : depth === 2 ? '../../' : '';
        window.location.href = prefix + 'public/login.html';
        return;
    }

    // 2. CHECK ROLE & BLOCK STATUS if authenticated
    if (user && !PUBLIC_PAGES.includes(page)) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            
            if (!doc.exists) {
                console.warn("User profile missing. Signing out...");
                await auth.signOut();
                return;
            }

            const data = doc.data();

            // A. Check Block Status
            if (data.isBlocked) {
                alert("Your account has been suspended. Please contact the Administrator.");
                await auth.signOut();
                window.location.href = '../../public/login.html';
                return;
            }

            // B. Role-Based Access Control (RBAC)
            const role = data.role;
            
            // STRICT PATH CHECKING
            if (path.includes('/student/') && role !== 'student') {
                handleUnauthorized();
            } 
            else if (path.includes('/teacher/') && role !== 'teacher') {
                handleUnauthorized();
            }
            else if (path.includes('/hod/') && role !== 'hod') {
                handleUnauthorized();
            }
            else if (path.includes('/principal/') && role !== 'principal') {
                handleUnauthorized();
            }
            else if (path.includes('/lab-assistant/') && role !== 'lab_assistant') {
                handleUnauthorized();
            }
            else if (path.includes('/admin/') && role !== 'admin') {
                // Admin pages are strictly for IT Admin now. 
                // Principal has their own portal.
                handleUnauthorized();
            }

        } catch (error) {
            console.error("Route Guard Error:", error);
            // Optional: Redirect to error page
        }
    }
});

function handleUnauthorized() {
    alert("Unauthorized Access: You do not have permission to view this portal.");
    // Redirect to the correct portal based on role would be better, 
    // but for now, we send them back or to login.
    history.back(); 
    // Fallback if history is empty
    setTimeout(() => {
        window.location.href = '../../public/login.html';
    }, 500);
}