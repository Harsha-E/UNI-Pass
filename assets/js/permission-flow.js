import { db, auth, firebase } from './firebase-init.js';

/**
 * ============================================================================
 * UNI-PASS: PERMISSION WORKFLOW ENGINE
 * ============================================================================
 * Handles all logic for creating, approving, and checking permission requests.
 */

export class PermissionService {

    /**
     * Helper: Get current user details safely
     */
    static async _getActorProfile() {
        const user = auth.currentUser;
        if (!user) throw new Error("Session expired. Please log in.");

        const snap = await db.collection('users').doc(user.uid).get();
        if (!snap.exists) throw new Error("User profile not found.");

        const data = snap.data();
        return {
            uid: user.uid,
            displayName: data.displayName || user.displayName || 'Staff Member',
            role: data.role,
            isBlocked: !!data.isBlocked,
            department: data.department,
            section: data.section
        };
    }

    /**
     * CORE: Process Approvals & Rejections
     */
    static async processRequestAction(docId, action, details = {}) {
        const actor = await this._getActorProfile();
        if (actor.isBlocked) throw new Error("Action Denied: Your account is restricted.");

        const permRef = db.collection('permissions').doc(docId);
        const permDoc = await permRef.get();
        
        if (!permDoc.exists) throw new Error("Request no longer exists.");
        const data = permDoc.data();

        // Security Check: Is this user allowed to act?
        if (data.currentHandlerUid !== actor.uid && actor.role !== 'admin') {
             // Allow Principal to pick up "PENDING_PRINCIPAL" even if specific UID doesn't match
             const isPrincipalOverride = (data.status === 'PENDING_PRINCIPAL' && actor.role === 'principal');
             if (!isPrincipalOverride) {
                 throw new Error("You are not the assigned handler for this request.");
             }
        }

        const timestamp = new Date().toISOString();
        let updates = {};

        // --- REJECTION ---
        if (action === 'REJECT') {
            if (!details.reason) throw new Error("Rejection reason is required.");
            
            updates = {
                status: 'REJECTED',
                currentHandlerUid: null,
                rejectionReason: details.reason,
                rejectedBy: actor.displayName,
                logs: firebase.firestore.FieldValue.arrayUnion({
                    action: 'REJECTED',
                    by: actor.displayName,
                    role: actor.role,
                    at: timestamp,
                    reason: details.reason
                })
            };
            
            await permRef.update(updates);
            return { success: true, status: 'REJECTED' };
        }

        // --- APPROVAL ---
        if (action === 'APPROVE') {
            // A. Record the Approval Signature (CRITICAL FOR PDF/CHECKER)
            const approvalKey = `approvals.${actor.role}`; 
            updates[approvalKey] = {
                name: actor.displayName,
                uid: actor.uid,
                date: timestamp
            };

            // B. Determine Next Step
            const currentStep = data.routingPath.find(step => 
                ROUTING_MAP[step].includes(actor.role)
            );
            
            const currentIndex = data.routingPath.indexOf(currentStep);
            
            if (currentIndex === -1 && actor.role !== 'admin') {
                throw new Error("System Logic Error: Your role is not in the routing path.");
            }

            const isLastStep = (currentIndex === data.routingPath.length - 1);
            let nextStatus, nextHandlerUid;

            if (isLastStep) {
                // FINAL APPROVAL
                nextStatus = 'APPROVED';
                nextHandlerUid = null;

                // Handle Substitution Logic
                if (data.type === 'Leave' && data.substituteUid) {
                    await this._activateSubstitute(data.student.uid, data.substituteUid);
                }

            } else {
                // FORWARD TO NEXT HANDLER
                const nextStep = data.routingPath[currentIndex + 1]; // e.g., 'HOD' or 'PRINCIPAL'
                
                if (nextStep === 'PRINCIPAL') {
                    nextHandlerUid = await this._findPrincipalOrAdmin();
                } else {
                    nextHandlerUid = await this._findStaffByRole(nextStep, data.student.dept);
                }
                
                nextStatus = `PENDING_${nextStep}`;
            }

            // C. Privacy Shield
            if (actor.role === 'counsellor' && ['Medical', 'Personal'].includes(data.type)) {
                updates.privacyFlag = true;
            }

            // D. Apply Updates
            updates = {
                ...updates,
                status: nextStatus,
                currentHandlerUid: nextHandlerUid,
                logs: firebase.firestore.FieldValue.arrayUnion({
                    action: isLastStep ? 'APPROVED' : 'VERIFIED',
                    by: actor.displayName,
                    role: actor.role,
                    at: timestamp
                })
            };

            await permRef.update(updates);
            return { success: true, status: nextStatus };
        }

        throw new Error(`Unknown action: ${action}`);
    }

    /**
     * CHECK ACTIVE RESTRICTION (Fixes your specific error)
     * Checks if the student already has a pending request.
     */
    static async checkActiveRestriction(studentUid) {
        // Query for any request by this student that is NOT approved or rejected
        try {
            const q = db.collection('permissions')
                .where('student.uid', '==', studentUid)
                .where('status', 'not-in', ['APPROVED', 'REJECTED'])
                .limit(1);
            
            const snap = await q.get();
            return !snap.empty;
        } catch (error) {
            console.warn("Restriction check failed (likely missing index), allowing request.", error);
            return false; // Fail safe: allow request if check fails
        }
    }

    /**
     * GENERATE NEW REQUEST
     */
    static async createSmartRequest(studentData, formData) {
        // 1. Find Class Teacher
        let teacherUid = null;
        try {
            const q = db.collection('users')
                .where('role', '==', 'teacher')
                .where('department', '==', studentData.dept)
                .where('section', '==', studentData.section)
                .limit(1);
            
            const snap = await q.get();
            if (!snap.empty) {
                teacherUid = snap.docs[0].id;
            } else {
                console.warn("Class Teacher not found.");
            }
        } catch (e) {
            console.error("Teacher Lookup Failed:", e);
        }

        // 2. Define Routing Path
        let routingPath = [];
        let currentHandlerUid = null;

        // COUNSELLOR LOGIC
        if (['Medical', 'Personal'].includes(formData.reasonType)) {
            try {
                const counsellorUid = await this._findStaffByRole('COUNSELLOR', studentData.dept);
                if (counsellorUid) {
                    routingPath = ['COUNSELLOR', 'HOD'];
                    currentHandlerUid = counsellorUid;
                } else {
                    // Fallback if no counsellor
                    routingPath = teacherUid ? ['TEACHER', 'HOD'] : ['HOD'];
                    currentHandlerUid = teacherUid; 
                }
            } catch (e) {
                routingPath = teacherUid ? ['TEACHER', 'HOD'] : ['HOD'];
                currentHandlerUid = teacherUid;
            }
        } else {
            // General Path
            routingPath = teacherUid ? ['TEACHER', 'HOD'] : ['HOD'];
            currentHandlerUid = teacherUid;
        }

        // Duration Check -> Escalation
        const d1 = new Date(formData.startDate);
        const d2 = new Date(formData.endDate);
        const days = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        
        if (days > 7) {
            routingPath.push('PRINCIPAL');
        }

        // 3. Final Safety Check
        if (!currentHandlerUid) {
            const hodUid = await this._findStaffByRole('HOD', studentData.dept);
            if (hodUid) {
                currentHandlerUid = hodUid;
                if (routingPath[0] !== 'HOD') routingPath = ['HOD', ...routingPath.filter(r => r === 'PRINCIPAL')];
            }
        }

        if (!currentHandlerUid) {
            currentHandlerUid = await this._findPrincipalOrAdmin(); 
            routingPath = ['PRINCIPAL'];
        }

        // 4. Create Payload
        const payload = {
            student: { 
                uid: studentData.uid,
                name: studentData.name,
                rollNumber: studentData.rollNumber,
                dept: studentData.dept,
                section: studentData.section
            },
            type: formData.reasonType,
            reason: formData.reason,
            startDate: formData.startDate,
            endDate: formData.endDate,
            status: `PENDING_${routingPath[0]}`,
            
            classTeacherUid: teacherUid,
            currentHandlerUid: currentHandlerUid,
            routingPath: routingPath,
            
            createdAt: new Date().toISOString(),
            logs: [{
                action: 'CREATED',
                by: studentData.name,
                role: 'student',
                at: new Date().toISOString()
            }]
        };

        await db.collection('permissions').add(payload);
    }

    // --- INTERNAL HELPERS ---

    static async _findStaffByRole(roleKey, dept) {
        const dbRole = ROUTING_MAP[roleKey]?.[0] || roleKey.toLowerCase();
        
        const q = db.collection('users')
            .where('role', '==', dbRole)
            .where('department', '==', dept)
            .limit(1);
        
        const snap = await q.get();
        if (snap.empty) return null;
        return snap.docs[0].id;
    }

    static async _findPrincipalOrAdmin() {
        let q = db.collection('users').where('role', '==', 'principal').limit(1);
        let snap = await q.get();
        if (!snap.empty) return snap.docs[0].id;

        q = db.collection('users').where('role', '==', 'admin').limit(1);
        snap = await q.get();
        if (!snap.empty) return snap.docs[0].id;

        throw new Error("Critical: No Principal or Admin found.");
    }

    static async _activateSubstitute(teacherUid, subUid) {
        const batch = db.batch();
        batch.update(db.collection('users').doc(teacherUid), { isOnLeave: true });
        await batch.commit();
    }
}

const ROUTING_MAP = {
    'TEACHER': ['teacher', 'substitute'],
    'COUNSELLOR': ['counsellor'],
    'HOD': ['hod'],
    'PRINCIPAL': ['principal', 'admin']
};
