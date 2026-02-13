import { db, auth, firebase } from './firebase-init.js';

/**
 * ============================================================================
 * UNI-PASS: WORKFLOW ENGINE (Fixed & Robust)
 * ============================================================================
 * Fixes:
 * 1. Writes to 'approvals' map (Essential for PDF/Checker signatures).
 * 2. Robust Class Teacher lookup (Prevents creation crashes).
 * 3. Smart Principal Routing (Falls back to Admin if Principal is missing).
 * 4. Counsellor Fallback (Prevents crash if no counsellor exists).
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

        // 1. Security Check: Is this user allowed to act?
        // We allow 'admin' to override locks (e.g. if a teacher is absent)
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
            // This creates the data structure: data.approvals.teacher.name = ...
            const approvalKey = `approvals.${actor.role}`; 
            updates[approvalKey] = {
                name: actor.displayName,
                uid: actor.uid,
                date: timestamp
            };

            // B. Determine Next Step
            // Find where we are in the routing path (e.g., ['TEACHER', 'HOD'])
            // Map the current actor's role to the path step
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

                // Handle Substitution Logic if applicable
                if (data.type === 'Leave' && data.substituteUid) {
                    await this._activateSubstitute(data.student.uid, data.substituteUid);
                }

            } else {
                // FORWARD TO NEXT HANDLER
                const nextStep = data.routingPath[currentIndex + 1]; // e.g., 'HOD' or 'PRINCIPAL'
                
                // Find the specific user for the next role
                if (nextStep === 'PRINCIPAL') {
                    // Fetch Principal (or Admin backup)
                    nextHandlerUid = await this._findPrincipalOrAdmin();
                } else {
                    // Fetch HOD/Teacher by Department
                    nextHandlerUid = await this._findStaffByRole(nextStep, data.student.dept);
                }
                
                nextStatus = `PENDING_${nextStep}`;
            }

            // C. Privacy Shield (Optional)
            if (actor.role === 'counsellor' && ['Medical', 'Personal'].includes(data.type)) {
                updates.privacyFlag = true; // Mark as private instead of erasing reason
            }

            // D. Apply Updates
            updates = {
                ...updates,
                status: nextStatus,
                currentHandlerUid: nextHandlerUid,
                logs: firebase.firestore.FieldValue.arrayUnion({
                    action: isLastStep ? 'APPROVED' : 'VERIFIED',
                    by: actor.displayName,
                    role: actor.role, // Critical for PDF logic
                    at: timestamp
                })
            };

            await permRef.update(updates);
            return { success: true, status: nextStatus };
        }

        throw new Error(`Unknown action: ${action}`);
    }

    /**
     * GENERATE NEW REQUEST
     * Fixed to prevent crashes if Teacher/Counsellor is missing.
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

        // 2. Define Routing Path & Find First Handler
        let routingPath = [];
        let currentHandlerUid = null;

        // CHECK COUNSELLOR LOGIC (With Fallback)
        if (['Medical', 'Personal'].includes(formData.reasonType)) {
            try {
                // Try to find a counsellor
                const counsellorUid = await this._findStaffByRole('COUNSELLOR', studentData.dept);
                
                if (counsellorUid) {
                    routingPath = ['COUNSELLOR', 'HOD'];
                    currentHandlerUid = counsellorUid;
                } else {
                    console.warn("No Counsellor found. Falling back to Teacher -> HOD path.");
                    // FALLBACK: If no counsellor, use standard Teacher -> HOD path
                    routingPath = teacherUid ? ['TEACHER', 'HOD'] : ['HOD'];
                    currentHandlerUid = teacherUid; 
                }
            } catch (e) {
                console.warn("Counsellor lookup error, falling back.", e);
                routingPath = teacherUid ? ['TEACHER', 'HOD'] : ['HOD'];
                currentHandlerUid = teacherUid;
            }
        } else {
            // General -> Teacher -> HOD
            routingPath = teacherUid ? ['TEACHER', 'HOD'] : ['HOD'];
            currentHandlerUid = teacherUid;
        }

        // Duration Check -> Escalation to Principal
        const d1 = new Date(formData.startDate);
        const d2 = new Date(formData.endDate);
        const days = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        
        if (days > 7) {
            routingPath.push('PRINCIPAL');
        }

        // 3. Final Safety Check for Handler
        // If we still don't have a handler (e.g. No Teacher AND No Counsellor), try HOD
        if (!currentHandlerUid) {
            const hodUid = await this._findStaffByRole('HOD', studentData.dept);
            if (hodUid) {
                currentHandlerUid = hodUid;
                // Adjust routing path if we skipped straight to HOD
                if (routingPath[0] !== 'HOD') routingPath = ['HOD', ...routingPath.filter(r => r === 'PRINCIPAL')];
            }
        }

        if (!currentHandlerUid) {
            // Final Safety Net: Send to Admin if routing fails completely
            currentHandlerUid = await this._findPrincipalOrAdmin(); 
            routingPath = ['PRINCIPAL']; // Force escalation
            console.warn("Routing failed. Escalated to Admin/Principal.");
        }

        // 4. Create Payload (Golden Schema)
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
            
            classTeacherUid: teacherUid, // Stored for PDF fallback
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
        // Map abstract role 'TEACHER' to db role 'teacher'
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
        // Try Principal
        let q = db.collection('users').where('role', '==', 'principal').limit(1);
        let snap = await q.get();
        if (!snap.empty) return snap.docs[0].id;

        // Fallback to Admin
        q = db.collection('users').where('role', '==', 'admin').limit(1);
        snap = await q.get();
        if (!snap.empty) return snap.docs[0].id;

        throw new Error("Critical: No Principal or Admin found in system.");
    }

    static async _activateSubstitute(teacherUid, subUid) {
        const batch = db.batch();
        batch.update(db.collection('users').doc(teacherUid), { isOnLeave: true });
        // Logic to notify substitute can go here
        await batch.commit();
    }
}

// Maps workflow steps to database roles
const ROUTING_MAP = {
    'TEACHER': ['teacher', 'substitute'],
    'COUNSELLOR': ['counsellor'],
    'HOD': ['hod'],
    'PRINCIPAL': ['principal', 'admin']
};
