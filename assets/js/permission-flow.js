import { db } from './firebase-init.js';

// Configuration Rules
const RULES = {
    requiresHOD: ['Medical', 'On-Duty'], // Reasons that trigger escalation
    maxDaysForTeacher: 2 // If > 2 days, escalation is automatic
};

/**
 * CORE WORKFLOW ENGINE
 * Handles the logic of moving a request from STUDENT -> TEACHER -> HOD -> APPROVED*/
export async function processApproval(docId, action, role, currentData) {
    if (!auth.currentUser) throw new Error("You must be logged in.");

    const user = auth.currentUser;
    
    // 1. FETCH APPROVER DETAILS (The missing link!)
    // We fetch the latest profile to get the official name (e.g., "Dr. K. Srinivas")
    const userProfileSnap = await db.collection('users').doc(user.uid).get();
    const userProfile = userProfileSnap.exists ? userProfileSnap.data() : {};
    
    // Use profile name first, then auth name, then fallback
    const approverName = userProfile.displayName || user.displayName || (role === 'hod' ? "Head of Dept" : "Faculty Member");
    const approverEmail = userProfile.email || user.email;

    const timestamp = new Date().toISOString();
    let updates = {};

    // --- LOGIC FOR TEACHER ---
    if (role === 'teacher') {
        if (action === 'approve') {
            // Check for auto-escalation (Duration > 2 days)
            const d1 = new Date(currentData.startDate);
            const d2 = new Date(currentData.endDate);
            const days = (d2 - d1) / (1000 * 60 * 60 * 24);

            if (days > 2) {
                updates = {
                    status: 'PENDING_HOD',
                    'approvals.teacher': { 
                        name: approverName, // SAVING NAME HERE
                        email: approverEmail,
                        uid: user.uid,
                        timestamp: timestamp,
                        action: 'APPROVED'
                    },
                    workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                        step: 'TEACHER_APPROVED',
                        actor: approverName, // AND HERE
                        timestamp: new Date(),
                        note: 'Escalated to HOD (Duration > 2 days)'
                    })
                };
            } else {
                // Final Approval
                updates = {
                    status: 'APPROVED',
                    approvalType: 'TEACHER_ONLY', // Mark that HOD wasn't needed
                    'approvals.teacher': { 
                        name: approverName, // SAVING NAME HERE
                        email: approverEmail,
                        uid: user.uid,
                        timestamp: timestamp,
                        action: 'APPROVED'
                    },
                    workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                        step: 'APPROVED',
                        actor: approverName,
                        timestamp: new Date(),
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
                workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                    step: 'REJECTED',
                    actor: approverName,
                    timestamp: new Date(),
                    note: 'Request Rejected by Teacher'
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
                    name: approverName, // SAVING HOD NAME HERE
                    email: approverEmail,
                    uid: user.uid,
                    timestamp: timestamp,
                    action: 'APPROVED'
                },
                workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                    step: 'APPROVED',
                    actor: approverName,
                    timestamp: new Date(),
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
                workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                    step: 'REJECTED',
                    actor: approverName,
                    timestamp: new Date(),
                    note: 'Rejected by HOD'
                })
            };
        }
    }

    // EXECUTE UPDATE
    await db.collection('permissions').doc(docId).update(updates);
}
