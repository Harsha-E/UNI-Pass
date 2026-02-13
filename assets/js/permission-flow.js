import { db, auth, firebase } from './firebase-init.js';

/**
 * ============================================================================
 * UNI-PASS: "Golden Schema" State Machine Engine
 * ============================================================================
 * Handles state transitions based on the `routingPath` array in permission docs.
 * All portal actions (Approve, Reject, etc.) are processed through this service.
 */

export class PermissionService {

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
            displayName: snap.data().displayName || user.displayName || 'Staff Member',
            role: snap.data().role,
            isBlocked: snap.data().isBlocked,
            department: snap.data().department,
            section: snap.data().section
        };
    }

    /**
     * UNIVERSAL ACTION: Processes approvals and rejections.
     * This is the core of the state machine.
     */
    static async processRequestAction(docId, action, details = {}) {
        const actor = await this._getActorProfile();
        if (actor.isBlocked) throw new Error("Security Restriction: Your account is blocked.");

        const permRef = db.collection('permissions').doc(docId);
        const permDoc = await permRef.get();
        if (!permDoc.exists) throw new Error("Request not found.");
        const data = permDoc.data();

        // Security Check: Is the actor the current handler?
        // Allow Principal/Admin override for requests escalated to Principal
        if (data.currentHandlerUid !== actor.uid) {
            const isPendingPrincipal = data.status === 'PENDING_PRINCIPAL';
            const principalOverride = isPendingPrincipal && ['principal', 'admin'].includes(actor.role);
            if (!principalOverride) {
                throw new Error("This request is not currently assigned to you or has already been processed.");
            }
        }

        const timestamp = new Date().toISOString();
        let updates = {};

        // --- REJECTION LOGIC (Applies to any role) ---
        if (action === 'REJECT') {
            if (!details.reason) throw new Error("A reason is required to reject a request.");
            updates = {
                status: 'REJECTED',
                currentHandlerUid: null,
                logs: firebase.firestore.FieldValue.arrayUnion({ action: 'REJECTED', by: actor.displayName, at: timestamp, reason: details.reason })
            };
            await permRef.update(updates);
            return { success: true, status: 'REJECTED' };
        }

        // --- APPROVAL & FORWARDING LOGIC ---
        if (action === 'APPROVE') {
            // Find current position in the routing path
            const currentPathRole = Object.keys(ROUTING_MAP).find(key => ROUTING_MAP[key].includes(actor.role));
            const currentRoleIndex = data.routingPath.indexOf(currentPathRole);

            if (currentRoleIndex === -1) throw new Error("Your role is not in the routing path for this request.");

            const isLastStep = currentRoleIndex === data.routingPath.length - 1;
            let nextStatus, nextHandlerUid;

            if (isLastStep) {
                nextStatus = 'APPROVED';
                nextHandlerUid = null; // Final approval

                // --- SPECIAL LOGIC: TEACHER LEAVE APPROVAL ---
                if (data.type === 'Leave' && data.student.rollNumber === 'FACULTY') {
                    const batch = db.batch();
                    const teacherRef = db.collection('users').doc(data.student.uid);
                    batch.update(teacherRef, {
                        isOnLeave: true,
                        currentSubstituteUid: data.substituteUid
                    });
                    await batch.commit();
                }
            } else {
                const nextRole = data.routingPath[currentRoleIndex + 1];
                const q = db.collection('users').where('role', '==', nextRole.toLowerCase()).where('department', '==', data.student.dept).limit(1);
                const nextHandlerSnap = await q.get();
                if (nextHandlerSnap.empty) {
                    // Fallback for Principal who might not have a department
                    if (nextRole === 'PRINCIPAL') {
                        let pSnap = await db.collection('users').where('role', '==', 'principal').limit(1).get();
                        
                        if (pSnap.empty) {
                            // Fallback to Admin if no Principal is configured
                            pSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
                        }

                        if (pSnap.empty) throw new Error(`Configuration Error: No Principal or Admin account found to handle escalation.`);
                        nextHandlerUid = pSnap.docs[0].id;
                    } else {
                        throw new Error(`Configuration Error: Cannot find next handler for role ${nextRole} in department ${data.student.dept}.`);
                    }
                } else {
                    nextHandlerUid = nextHandlerSnap.docs[0].id;
                }
                nextStatus = `PENDING_${nextRole}`;
            }

            // Part C: The Confidentiality Shield
            if (actor.role === 'counsellor' && ['Medical', 'Personal'].includes(data.type)) {
                updates.reason = "Confidential - Verified by Wellness Team";
            }

            updates = {
                ...updates,
                status: nextStatus,
                currentHandlerUid: nextHandlerUid,
                logs: firebase.firestore.FieldValue.arrayUnion({ action: 'VERIFIED', by: actor.displayName, at: timestamp })
            };

            await permRef.update(updates);
            return { success: true, status: nextStatus };
        }

        throw new Error(`Unknown action: ${action}`);
    }

    /**
     * ACTION: BLOCK USER (Teacher/Admin Power)
     */
    static async blockStudent(studentId, reason) {
        const actor = await this._getActorProfile();
        if (!['teacher', 'hod', 'admin'].includes(actor.role)) {
            throw new Error("Insufficient privileges to block users.");
        }

        const batch = db.batch();
        const timestamp = new Date().toISOString();

        const userRef = db.collection('users').doc(studentId);
        batch.update(userRef, {
            isBlocked: true,
            blockedAt: timestamp,
            blockedBy: actor.uid,
            blockReason: reason
        });
        await batch.commit();
    }

    /**
     * PHASE 1: PAUSE SYSTEM
     */
    static async checkActiveRestriction(studentUid) {
        const q = db.collection('permissions').where('student.uid', '==', studentUid).where('status', 'not-in', ['APPROVED', 'REJECTED']).limit(1);
        const snap = await q.get();
        return !snap.empty;
    }

    /**
     * PHASE 1: BLIND SMART ROUTING
     */
    static async createSmartRequest(studentData, formData) {
        // 1. Find Class Teacher
        const teacherQ = db.collection('users').where('role', '==', 'teacher').where('department', '==', studentData.dept).where('section', '==', studentData.section).limit(1);
        const teacherQuery = await teacherQ.get();
        if (teacherQuery.empty) {
            throw new Error(`Configuration Error: No Class Teacher found for ${studentData.dept}-${studentData.section}`);
        }
        const teacherDoc = teacherQuery.docs[0];
        const teacherData = teacherDoc.data();
        const teacherUid = teacherDoc.id;

        // 3. Calculate Duration & Routing Path
        const d1 = new Date(formData.startDate);
        const d2 = new Date(formData.endDate);
        const duration = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

        let routingPath = [];
        let currentHandlerUid;

        // Confidentiality Shield: Route to Counsellor first if needed
        if (['Medical', 'Personal'].includes(formData.reasonType)) {
            routingPath.push('COUNSELLOR');
            const counsellorQ = db.collection('users').where('role', '==', 'counsellor').where('department', '==', studentData.dept).limit(1);
            const counsellorSnap = await counsellorQ.get();
            if (counsellorSnap.empty) throw new Error(`Configuration Error: No Counsellor found for ${studentData.dept}`);
            currentHandlerUid = counsellorSnap.docs[0].id;
        }

        // Standard Path
        routingPath.push('TEACHER', 'HOD');
        if (duration > 7) routingPath.push('PRINCIPAL');

        // If not already assigned to counsellor, assign to teacher/sub
        if (!currentHandlerUid) {
            currentHandlerUid = (teacherData.isOnLeave && teacherData.currentSubstituteUid) ? teacherData.currentSubstituteUid : teacherUid;
        }

        // Determine initial status based on the first step in the workflow.
        const initialStatus = `PENDING_${routingPath[0]}`;

        // 4. Construct Payload
        const payload = {
            student: { ...studentData },
            type: formData.reasonType,
            reason: formData.reason,
            startDate: formData.startDate,
            endDate: formData.endDate,
            status: initialStatus,
            classTeacherUid: teacherUid,
            currentHandlerUid: currentHandlerUid,
            routingPath: routingPath,
            logs: [{ action: 'CREATED', by: studentData.name, at: new Date().toISOString() }]
        };

        await db.collection('permissions').add(payload);
    }

    /**
     * TEACHER LEAVE WORKFLOW
     * Allows a teacher to apply for leave and assign a substitute.
     * Enforces: One substitute can only handle one active leave work.
     */
    static async createLeaveRequest(teacherData, formData) {
        // 1. Check if substitute is away
        const subDoc = await db.collection('users').doc(formData.substituteUid).get();
        if (subDoc.exists && subDoc.data().isOnLeave) {
            throw new Error("This colleague is currently on leave.");
        }

        // 2. Check if substitute is already subbing for someone (1:1 Constraint)
        const subbingQuery = await db.collection('users')
            .where('currentSubstituteUid', '==', formData.substituteUid)
            .get();
        if (!subbingQuery.empty) {
            throw new Error("This colleague is already acting as a substitute for another teacher.");
        }

        // 3. Check for pending requests naming this substitute
        const pendingQuery = await db.collection('permissions')
            .where('type', '==', 'Leave')
            .where('substituteUid', '==', formData.substituteUid)
            .where('status', '==', 'PENDING_HOD')
            .get();
        if (!pendingQuery.empty) {
            throw new Error("This substitute is already assigned to a pending leave request.");
        }

        // 4. Find HOD for the department
        const hodQuery = await db.collection('users')
            .where('role', '==', 'hod')
            .where('department', '==', teacherData.department)
            .limit(1)
            .get();

        if (hodQuery.empty) throw new Error(`Configuration Error: No HOD found for ${teacherData.department}`);
        const hodUid = hodQuery.docs[0].id;

        const payload = {
            student: { // Requester info (using student field for schema compatibility)
                uid: teacherData.uid,
                name: teacherData.displayName,
                rollNumber: "FACULTY",
                dept: teacherData.department,
                section: teacherData.section
            },
            type: 'Leave',
            reason: formData.reason,
            startDate: formData.startDate,
            endDate: formData.endDate,
            substituteUid: formData.substituteUid,
            status: 'PENDING_HOD',
            currentHandlerUid: hodUid,
            routingPath: ['HOD'],
            logs: [{ action: 'CREATED', by: teacherData.displayName, at: new Date().toISOString() }]
        };

        await db.collection('permissions').add(payload);
    }
}

/**
 * Maps actor roles to the roles defined in the routingPath array.
 * This allows substitutes to be treated as teachers in the path.
 */
const ROUTING_MAP = {
    'TEACHER': ['teacher', 'substitute'],
    'COUNSELLOR': ['counsellor'],
    'HOD': ['hod'],
    'PRINCIPAL': ['principal', 'admin']
};