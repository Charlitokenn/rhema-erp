'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { sendPushNotification } from '@/lib/onesignal-server';
import type { OneSignalFilter } from '@/types/onesignal';

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

export type RequisitionRole = 'requestor' | 'reviewer' | 'approver';

/**
 * Every state transition in the requisition lifecycle maps to one of these.
 * The action name encodes BOTH who triggered it AND what they did — which
 * makes the routing table below unambiguous.
 */
export type RequisitionAction =
    | 'submitted'               // requestor → notify ALL reviewers
    | 'reviewer_supported'      // reviewer  → notify requestor + ALL approvers
    | 'reviewer_referred_back'  // reviewer  → notify requestor only
    | 'reviewer_rejected'       // reviewer  → notify requestor + ALL approvers
    | 'approver_approved'       // approver  → notify requestor + specific reviewer
    | 'approver_rejected'       // approver  → notify requestor + specific reviewer
    | 'approver_referred_back'; // approver  → notify requestor only

export interface RequisitionNotificationParams {
    action: RequisitionAction;
    requisitionId: string;
    /** Short human-readable title shown in the notification body. */
    requisitionTitle: string;
    /** Clerk userId of the person who created the requisition. */
    requestorId: string;
    /**
     * Clerk userId of the reviewer who handled this requisition.
     * Required for `approver_approved` and `approver_rejected` so the
     * specific reviewer (not all reviewers) receives the outcome.
     */
    reviewerId?: string;
    /** Deep-link URL opened when the user taps the notification. */
    url?: string;
    /** Any extra key/value pairs forwarded as OneSignal `data`. */
    additionalData?: Record<string, string>;
}

export type RequisitionNotificationResult =
    | { success: true; dispatched: number; failed: number }
    | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Role → authorised actions
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_FOR_ACTION: Record<RequisitionAction, RequisitionRole> = {
    submitted:               'requestor',
    reviewer_supported:      'reviewer',
    reviewer_referred_back:  'reviewer',
    reviewer_rejected:       'reviewer',
    approver_approved:       'approver',
    approver_rejected:       'approver',
    approver_referred_back:  'approver',
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification copy
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES: Record< RequisitionAction, { heading: string; body: (title: string) => string }
    > = {
        submitted: {
            heading: 'New Requisition Submitted',
            body: (t) => `"${t}" has been submitted and is awaiting your review.`,
        },
        reviewer_supported: {
            heading: 'Requisition Supported',
            body: (t) => `"${t}" has been supported by the reviewer and is pending approval.`,
        },
        reviewer_referred_back: {
            heading: 'Requisition Referred Back',
            body: (t) => `"${t}" has been referred back for revision by the reviewer.`,
        },
        reviewer_rejected: {
            heading: 'Requisition Rejected by Reviewer',
            body: (t) => `"${t}" was rejected at the review stage.`,
        },
        approver_approved: {
            heading: 'Requisition Approved',
            body: (t) => `"${t}" has been approved.`,
        },
        approver_rejected: {
            heading: 'Requisition Rejected',
            body: (t) => `"${t}" was rejected by the approver.`,
        },
        approver_referred_back: {
            heading: 'Requisition Referred Back',
            body: (t) => `"${t}" has been referred back for revision by the approver.`,
        },
    };

// ─────────────────────────────────────────────────────────────────────────────
// Recipient resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A RoleTarget fans out to every OneSignal user whose tags contain
 * `{role}: "true"`, excluding the caller so they never receive
 * a notification they themselves triggered.
 */
type RoleTarget = {
    kind: 'role';
    role: RequisitionRole;
    excludeClerkId: string;
};

/**
 * A UserTarget sends directly to one Clerk user via OneSignal external_id.
 */
type UserTarget = {
    kind: 'user';
    clerkId: string;
};

type NotificationTarget = RoleTarget | UserTarget;

function resolveRecipients(
    action: RequisitionAction,
    {
        requestorId,
        reviewerId,
        callerClerkId,
    }: {
        requestorId: string;
        reviewerId?: string;
        callerClerkId: string;
    },
): NotificationTarget[] {
    switch (action) {
        // ── Requestor submits → all reviewers ─────────────────────────────────
        case 'submitted':
            return [
                { kind: 'role', role: 'reviewer', excludeClerkId: callerClerkId },
            ];

        // ── Reviewer supports/rejects → requestor + all approvers ─────────────
        case 'reviewer_supported':
        case 'reviewer_rejected':
            return [
                { kind: 'user', clerkId: requestorId },
                { kind: 'role', role: 'approver', excludeClerkId: callerClerkId },
            ];

        // ── Reviewer refers back → requestor only ─────────────────────────────
        case 'reviewer_referred_back':
            return [
                { kind: 'user', clerkId: requestorId },
            ];

        // ── Approver approves/rejects → requestor + specific reviewer ──────────
        case 'approver_approved':
        case 'approver_rejected': {
            const targets: NotificationTarget[] = [
                { kind: 'user', clerkId: requestorId },
            ];
            if (reviewerId) {
                targets.push({ kind: 'user', clerkId: reviewerId });
            }
            return targets;
        }

        // ── Approver refers back → requestor only ─────────────────────────────
        case 'approver_referred_back':
            return [
                { kind: 'user', clerkId: requestorId },
            ];

        default:
            return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the OneSignal filter array for role-based fan-out.
 *
 * Resulting logic:
 *   tag[role] = "true"
 *   AND tag[environment] = <current env>      ← isolates dev/staging/prod
 *   AND tag[clerk_user_id] != <callerClerkId> ← caller never notifies themselves
 */
function buildRoleFilters(
    role: RequisitionRole,
    excludeClerkId: string,
): OneSignalFilter[] {
    return [
        { field: 'tag', key: role, relation: '=', value: 'true' },
        { operator: 'AND' },
        { field: 'tag', key: 'clerk_user_id', relation: '!=', value: excludeClerkId },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Server action
// ─────────────────────────────────────────────────────────────────────────────

export async function sendRequisitionNotification(
    params: RequisitionNotificationParams,
): Promise<RequisitionNotificationResult> {

    // ── 1. Authentication ──────────────────────────────────────────────────
    const { userId: callerClerkId } = await auth();
    if (!callerClerkId) {
        return { success: false, error: 'Unauthorized' };
    }

    // ── 2. Role-based authorization ────────────────────────────────────────
    // We fetch the full Clerk user to read publicMetadata.requisitionRole,
    // which is not included in the JWT session claims by default.
    const caller = await currentUser();
    const callerRoles =
        (caller?.publicMetadata?.requisitionRole as RequisitionRole[] | undefined) ?? [];
    const requiredRole = ROLE_FOR_ACTION[params.action];

    if (!callerRoles.includes(requiredRole)) {
        return {
            success: false,
            error: `Forbidden: "${params.action}" requires the "${requiredRole}" role. ` +
                `Caller has: [${callerRoles.join(', ') || 'none'}].`,
        };
    }

    // ── 3. Build notification content ──────────────────────────────────────
    const { heading, body } = TEMPLATES[params.action];
    const message = body(params.requisitionTitle);

    const notificationData: Record<string, string> = {
        requisitionId: params.requisitionId,
        action: params.action,
        ...(params.additionalData ?? {}),
    };

    // ── 4. Resolve recipients ──────────────────────────────────────────────
    const targets = resolveRecipients(params.action, {
        requestorId: params.requestorId,
        reviewerId: params.reviewerId,
        callerClerkId,
    });

    if (targets.length === 0) {
        return { success: false, error: `No recipients resolved for action "${params.action}".` };
    }

    // ── 5. Dispatch ────────────────────────────────────────────────────────
    let dispatched = 0;
    let failed = 0;

    for (const target of targets) {
        try {
            if (target.kind === 'role') {
                // Fan-out to every user whose OneSignal tags match the role
                await sendPushNotification({
                    heading,
                    message,
                    url: params.url,
                    data: notificationData,
                    target: {
                        type: 'filters',
                        filters: buildRoleFilters(target.role, target.excludeClerkId),
            },
                });
            } else {
                // Skip self-notification (defensive guard for direct user targets)
                if (target.clerkId === callerClerkId) continue;

                await sendPushNotification({
                    heading,
                    message,
                    url: params.url,
                    data: notificationData,
                    target: {
                        type: 'external_ids',
                        ids: [target.clerkId],
                    },
                });
            }
            dispatched++;
        } catch (err) {
            console.error(
                '[sendRequisitionNotification] dispatch failed',
                { target, action: params.action },
                err,
            );
            failed++;
        }
    }

    if (dispatched === 0) {
        return { success: false, error: 'All notification dispatches failed.' };
    }

    return { success: true, dispatched, failed };
}

/**
 * Central server action for all requisition lifecycle notifications.
 *
 * Usage from a client component or another server action:
 *
 * ```ts
 * // Requestor submits
 * await sendRequisitionNotification({
 *   action: 'submitted',
 *   requisitionId: req.id,
 *   requisitionTitle: req.title,
 *   requestorId: currentUserId,
 *   url: `/requisitions/${req.id}`,
 * });
 *
 * // Reviewer supports
 * await sendRequisitionNotification({
 *   action: 'reviewer_supported',
 *   requisitionId: req.id,
 *   requisitionTitle: req.title,
 *   requestorId: req.createdBy,
 *   url: `/requisitions/${req.id}`,
 * });
 *
 * // Approver approves — pass reviewerId so the specific reviewer is notified
 * await sendRequisitionNotification({
 *   action: 'approver_approved',
 *   requisitionId: req.id,
 *   requisitionTitle: req.title,
 *   requestorId: req.createdBy,
 *   reviewerId: req.reviewedBy,
 *   url: `/requisitions/${req.id}`,
 * });
 * ```
 */