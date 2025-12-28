import { db } from './firebase-init.js';

// Configuration Rules
const RULES = {
    requiresHOD: ['Medical', 'On-Duty'], // Reasons that trigger escalation
    maxDaysForTeacher: 2 // If > 2 days, escalation is automatic
};

/**
 * CORE WORKFLOW ENGINE
 * Handles the logic of moving a request from STUDENT -> TEACHER -> HOD -> APPROVED
 */
export async function processApproval(docId, action, userRole, currentData) {
    
    let newStatus = currentData.status;
    let auditLog = `Action: ${action.toUpperCase()} by ${userRole}`;
    let historyEntry = {
        step: action === 'approve' ? 'APPROVED' : 'REJECTED',
        actor: userRole,
        timestamp: new Date(),
        note: ''
    };

    // --- 1. TEACHER LOGIC ---
    if (userRole === 'teacher') {
        if (action === 'approve') {
            // Calculate Duration
            const d1 = new Date(currentData.startDate);
            const d2 = new Date(currentData.endDate);
            const days = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

            // Check Rules
            const isLongLeave = days > RULES.maxDaysForTeacher;
            const isSensitive = RULES.requiresHOD.includes(currentData.reasonType);

            if (isLongLeave || isSensitive) {
                newStatus = 'PENDING_HOD';
                historyEntry.step = 'ESCALATED';
                historyEntry.note = `Escalated: Duration (${days} days) or Reason (${currentData.reasonType}) requires HOD.`;
                auditLog = "Escalated to HOD";
            } else {
                newStatus = 'APPROVED';
                historyEntry.note = "Final Approval Granted by Class Teacher.";
            }
        } else if (action === 'reject') {
            newStatus = 'REJECTED';
            historyEntry.note = currentData.rejectReason || "Rejected by Class Teacher.";
        }
    }

    // --- 2. HOD LOGIC ---
    if (userRole === 'hod') {
        if (action === 'approve') {
            newStatus = 'APPROVED';
            historyEntry.note = "Final Approval Granted by HOD.";
        } else if (action === 'reject') {
            newStatus = 'REJECTED';
            historyEntry.note = currentData.rejectReason || "Rejected by HOD.";
        }
    }

    // --- 3. EXECUTE DB UPDATE ---
    try {
        await db.collection('permissions').doc(docId).update({
            status: newStatus,
            // We append to the array of history events
            workflowHistory: firebase.firestore.FieldValue.arrayUnion(historyEntry)
        });
        console.log(`Workflow Updated: ${docId} -> ${newStatus}`);
    } catch (error) {
        console.error("Workflow Error:", error);
        throw error;
    }
}