import { db, auth } from './firebase-init.js';

/**
 * ============================================================================
 * UNI-PASS WORKFLOW ENGINE (Enterprise Grade)
 * ============================================================================
 * Handles state transitions, role-based authority, and automatic escalation policies.
 */

const CONFIG = {
    ESCALATION_THRESHOLD_DAYS: 2,
    SENSITIVE_TYPES: ['Medical', 'On-Duty', 'Symposium']
};

export class PermissionService {

    /**
     * Determines if a request requires HOD intervention.
     * @private
     */
    static _checkEscalation(data) {
        const d1 = new Date(data.startDate);
        const d2 = new Date(data.endDate);
        const duration = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1; // Inclusive duration

        const isLongLeave = duration > CONFIG.ESCALATION_THRESHOLD_DAYS;
        const isSensitive = CONFIG.SENSITIVE_TYPES.includes(data.reasonType);

        return {
            requiresEscalation: isLongLeave || isSensitive,
            reason: isLongLeave ? `Duration (${duration} days) exceeds limit` : `Sensitive Category (${data.reasonType})`
        };
    }

    /**
     * Fetches authenticated user profile to ensure data integrity.
     * @private
     */
    static async _getActorProfile() {
        const user = auth.currentUser;
        if (!user) throw new Error("Session expired. Please log in.");

        const snap = await db.collection('users').doc(user.uid).get();
        if (!snap.exists) throw new Error("User profile corrupted.");

        return {
            uid: user.uid,
            email: user.email,
            displayName: snap.data().displayName || user.displayName || 'Staff Member',
            role: snap.data().role,
            isBlocked: snap.data().isBlocked
        };
    }

    /**
     * ACTION: APPROVE
     * Handles Teacher -> HOD escalation automatically.
     */
    static async approveRequest(docId, currentData) {
        const actor = await this._getActorProfile();
        
        if (actor.isBlocked) throw new Error("Security Restriction: Your account is blocked.");

        const timestamp = new Date().toISOString();
        const escalationCheck = this._checkEscalation(currentData);
        let updates = {};

        // --- TEACHER LOGIC ---
        if (actor.role === 'teacher') {
            if (escalationCheck.requiresEscalation) {
                // ESCALATE
                updates = {
                    status: 'PENDING_HOD',
                    'approvals.teacher': {
                        uid: actor.uid,
                        name: actor.displayName,
                        email: actor.email,
                        action: 'ENDORSED',
                        timestamp: timestamp
                    },
                    workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                        step: 'TEACHER_ESCALATED',
                        actor: actor.displayName,
                        role: 'TEACHER',
                        timestamp: timestamp,
                        note: `Escalated: ${escalationCheck.reason}`
                    })
                };
            } else {
                // FINALIZE
                updates = {
                    status: 'APPROVED',
                    approvalType: 'TEACHER_ONLY',
                    'approvals.teacher': {
                        uid: actor.uid,
                        name: actor.displayName,
                        email: actor.email,
                        action: 'APPROVED',
                        timestamp: timestamp
                    },
                    workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                        step: 'APPROVED',
                        actor: actor.displayName,
                        role: 'TEACHER',
                        timestamp: timestamp,
                        note: 'Request Approved (Standard)'
                    })
                };
            }
        } 
        // --- HOD LOGIC ---
        else if (actor.role === 'hod') {
            updates = {
                status: 'APPROVED',
                'approvals.hod': {
                    uid: actor.uid,
                    name: actor.displayName,
                    email: actor.email,
                    action: 'APPROVED',
                    timestamp: timestamp
                },
                workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                    step: 'APPROVED',
                    actor: actor.displayName,
                    role: 'HOD',
                    timestamp: timestamp,
                    note: 'Final Approval Granted'
                })
            };
        } else {
            throw new Error("Unauthorized Role for Approval");
        }

        await db.collection('permissions').doc(docId).update(updates);
        return { success: true, status: updates.status };
    }

    /**
     * ACTION: REJECT
     */
    static async rejectRequest(docId, reason) {
        const actor = await this._getActorProfile();
        const timestamp = new Date().toISOString();

        const updateKey = actor.role === 'teacher' ? 'approvals.teacher' : 'approvals.hod';

        const updates = {
            status: 'REJECTED',
            [updateKey]: {
                uid: actor.uid,
                name: actor.displayName,
                email: actor.email,
                action: 'REJECTED',
                timestamp: timestamp
            },
            workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                step: 'REJECTED',
                actor: actor.displayName,
                role: actor.role.toUpperCase(),
                timestamp: timestamp,
                note: reason || 'Request Declined'
            })
        };

        await db.collection('permissions').doc(docId).update(updates);
    }

    /**
     * ACTION: BLOCK USER (Teacher/Admin Power)
     * Rejects the current request AND locks the student's account.
     */
    static async blockStudent(permissionId, studentId, reason) {
        const actor = await this._getActorProfile();
        if (!['teacher', 'hod', 'admin'].includes(actor.role)) {
            throw new Error("Insufficient privileges to block users.");
        }

        const batch = db.batch();
        const timestamp = new Date().toISOString();

        // 1. Update Permission Doc (Reject)
        const permRef = db.collection('permissions').doc(permissionId);
        batch.update(permRef, {
            status: 'REJECTED',
            workflowHistory: firebase.firestore.FieldValue.arrayUnion({
                step: 'BLOCKED',
                actor: actor.displayName,
                role: actor.role.toUpperCase(),
                timestamp: timestamp,
                note: `USER BLOCKED: ${reason}`
            })
        });

        // 2. Update User Doc (Block)
        const userRef = db.collection('users').doc(studentId);
        batch.update(userRef, {
            isBlocked: true,
            blockedAt: timestamp,
            blockedBy: actor.uid,
            blockReason: reason
        });

        await batch.commit();
    }
}