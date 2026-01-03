import { db, auth } from './firebase-init.js'; // FIXED: Added auth

// Configuration Rules
const RULES = {
    requiresHOD: ['Medical', 'On-Duty'],
    maxDaysForTeacher: 2 
};

/**
 * CORE WORKFLOW ENGINE
 * Handles the logic of moving a request from STUDENT -> TEACHER -> HOD -> APPROVED
 */
export async function processApproval(docId, action, role, currentData) {
    // 1. Safety Check
    if (!auth.currentUser) throw new Error("You must be logged in.");

    const user = auth.currentUser;
    
    // 2. FETCH APPROVER DETAILS
    // We fetch the real name (e.g., "Dr. K. Srinivas") from the 'users' collection
    // instead of just using the login email.
    let approverName = user.displayName;
    let approverEmail = user.email;

    try {
        const userProfileSnap = await db.collection('users').doc(user.uid).get();
        if (userProfileSnap.exists) {
            const profile = userProfileSnap.data();
            approverName = profile.displayName || approverName;
            approverEmail = profile.email || approverEmail;
        }
    } catch (e) {
        console.warn("Profile fetch failed, using default auth name.");
    }
    
    // Fallback if name is still empty
    if (!approverName) {
        approverName = (role === 'hod' ? "Head of Dept" : "Faculty Member");
    }

    const timestamp = new Date().toISOString();
    let updates = {};

    // 3. GET FIRESTORE FIELDVALUE (Safe Access)
    // This handles cases where 'firebase' global might be accessed differently
    const FieldValue = window.firebase ? window.firebase.firestore.FieldValue : null;
    if (!FieldValue) throw new Error("Firebase SDK not fully loaded. Refresh page.");

    // --- LOGIC FOR TEACHER ---
    if (role === 'teacher') {
        if (action === 'approve') {
            const d1 = new Date(currentData.startDate);
            const d2 = new Date(currentData.endDate);
            const days = (d2 - d1) / (1000 * 60 * 60 * 24);
            const isMedical = currentData.reasonType === 'Medical';

            // Auto-Escalation Logic
            if (days > 2 || isMedical) {
                updates = {
                    status: 'PENDING_HOD',
                    'approvals.teacher': { 
                        name: approverName, // SAVES "Dr. Name"
                        email: approverEmail,
                        uid: user.uid,
                        timestamp: timestamp,
                        action: 'APPROVED (ESCALATED)'
                    },
                    workflowHistory: FieldValue.arrayUnion({
                        step: 'TEACHER_APPROVED',
                        actor: approverName,
                        timestamp: new Date().toISOString(),
                        note: `Escalated to HOD (${isMedical ? 'Medical' : '> 2 Days'})`
                    })
                };
            } else {
                // Final Approval
                updates = {
                    status: 'APPROVED',
                    approvalType: 'TEACHER_ONLY',
                    'approvals.teacher': { 
                        name: approverName, 
                        email: approverEmail,
                        uid: user.uid,
                        timestamp: timestamp,
                        action: 'APPROVED'
                    },
                    workflowHistory: FieldValue.arrayUnion({
                        step: 'APPROVED',
                        actor: approverName,
                        timestamp: new Date().toISOString(),
                        note: 'Final Approval Granted'
                    })
                };
            }
        } else {
            // REJECT
            updates = {
                status: 'REJECTED',
                'approvals.teacher': { 
                    name: approverName,
                    uid: user.uid,
                    timestamp: timestamp,
                    action: 'REJECTED'
                },
                workflowHistory: FieldValue.arrayUnion({
                    step: 'REJECTED',
                    actor: approverName,
                    timestamp: new Date().toISOString(),
                    note: currentData.rejectReason || 'Request Rejected by Teacher'
                })
            };
        }
    }

    // --- LOGIC FOR HOD ---
    if (role === 'hod') {
        if (action === 'approve') {
            updates = {
                status: 'APPROVED',
                'approvals.hod': { 
                    name: approverName, // SAVES HOD NAME
                    email: approverEmail,
                    uid: user.uid,
                    timestamp: timestamp,
                    action: 'APPROVED'
                },
                workflowHistory: FieldValue.arrayUnion({
                    step: 'APPROVED',
                    actor: approverName,
                    timestamp: new Date().toISOString(),
                    note: 'Final Approval by HOD'
                })
            };
        } else {
            updates = {
                status: 'REJECTED',
                'approvals.hod': { 
                    name: approverName,
                    uid: user.uid,
                    timestamp: timestamp,
                    action: 'REJECTED'
                },
                workflowHistory: FieldValue.arrayUnion({
                    step: 'REJECTED',
                    actor: approverName,
                    timestamp: new Date().toISOString(),
                    note: currentData.rejectReason || 'Rejected by HOD'
                })
            };
        }
    }

    // EXECUTE UPDATE
    await db.collection('permissions').doc(docId).update(updates);
}
