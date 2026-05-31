// src/actions/notifications.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
    sendPushNotification,
    getNotificationStats,
    OneSignalError,
} from '@/lib/onesignal-server';
import type {
    SendNotificationRequest,
    NotificationStats,
} from '@/types/onesignal';

// ── Shared result type ────────────────────────────────────────────────────────

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string; code?: number };

// ── Guard: require auth ───────────────────────────────────────────────────────

async function requireAuth(): Promise<string> {
    const { userId } = await auth();
    if (!userId) {
        throw new Error('Unauthorized');
    }
    return userId;
}

// ── Guard: require admin role ─────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
        throw new Error('Unauthorized');
    }
    // Check for admin role in public metadata
    const role = sessionClaims?.metadata?.role //|| sessionClaims?.publicMetadata?.role;
    if (role !== 'admin') {
        throw new Error('Forbidden: Admin access required');
    }
    return userId;
}

// ── Action: send notification to a specific user by Clerk ID ─────────────────

export async function sendNotificationToUser(
    targetClerkUserId: string,
    heading: string,
    message: string,
    options?: {
        url?: string;
        imageUrl?: string;
        data?: Record<string, string>;
    },
): Promise<ActionResult<{ notificationId: string; recipients: number }>> {
    try {
        // Only authenticated users can trigger notifications
        await requireAuth();

        if (!targetClerkUserId || !heading || !message) {
            return { success: false, error: 'Missing required fields.' };
        }

        const result = await sendPushNotification({
            heading,
            message,
            ...options,
            target: { type: 'external_ids', ids: [targetClerkUserId] },
        });

        return {
            success: true,
            data: { notificationId: result.id, recipients: result.recipients },
        };
    } catch (err) {
        if (err instanceof OneSignalError) {
            console.error('[Action] OneSignal error:', err.details);
            return { success: false, error: err.message, code: err.statusCode };
        }
        console.error('[Action] Unexpected error:', err);
        return { success: false, error: 'Failed to send notification.' };
    }
}

// ── Action: send notification to the currently authenticated user ─────────────

export async function sendNotificationToSelf(
    heading: string,
    message: string,
    options?: {
        url?: string;
        imageUrl?: string;
        data?: Record<string, string>;
    },
): Promise<ActionResult<{ notificationId: string }>> {
    try {
        // Uses the Clerk userId of whoever is calling this action
        const userId = await requireAuth();

        // Validate input
        if (!heading?.trim() || !message?.trim()) {
            return { success: false, error: 'Heading and message are required.' };
        }

        const result = await sendPushNotification({
            heading,
            message,
            ...options,
            target: { type: 'external_ids', ids: [userId] },
        });

        return { success: true, data: { notificationId: result.id } };
    } catch (err) {
        if (err instanceof OneSignalError) {
            return { success: false, error: err.message, code: err.statusCode };
        }
        return { success: false, error: 'Failed to send notification.' };
    }
}

// ── Action: broadcast to a OneSignal segment ──────────────────────────────────

export async function broadcastToSegment(
    segmentName: string,
    heading: string,
    message: string,
    options?: {
        url?: string;
        imageUrl?: string;
    },
): Promise<ActionResult<{ notificationId: string; recipients: number }>> {
    try {
        // Require admin role for fan-out operations
        await requireAdmin();

        // Validate input
        if (!heading?.trim() || !message?.trim()) {
            return { success: false, error: 'Heading and message are required.' };
        }

        const result = await sendPushNotification({
            heading,
            message,
            ...options,
            target: { type: 'segments', names: [segmentName] },
        });

        return {
            success: true,
            data: { notificationId: result.id, recipients: result.recipients },
        };
    } catch (err) {
        if (err instanceof OneSignalError) {
            return { success: false, error: err.message, code: err.statusCode };
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to broadcast notification.';
        return { success: false, error: errorMessage };
    }
}

// ── Action: bulk notify multiple users ───────────────────────────────────────

export async function sendNotificationToUsers(
    clerkUserIds: string[],
    heading: string,
    message: string,
    options?: { url?: string; imageUrl?: string },
): Promise<ActionResult<{ notificationId: string; recipients: number }>> {
    try {
        // Require admin role for bulk fan-out operations
        await requireAdmin();

        // Validate input
        if (!heading?.trim() || !message?.trim()) {
            return { success: false, error: 'Heading and message are required.' };
        }

        if (!clerkUserIds.length) {
            return { success: false, error: 'No users specified.' };
        }
        // OneSignal accepts up to 2000 external IDs per request
        if (clerkUserIds.length > 2000) {
            return { success: false, error: 'Maximum 2000 users per request.' };
        }

        const result = await sendPushNotification({
            heading,
            message,
            ...options,
            target: { type: 'external_ids', ids: clerkUserIds },
        });

        return {
            success: true,
            data: { notificationId: result.id, recipients: result.recipients },
        };
    } catch (err) {
        if (err instanceof OneSignalError) {
            return { success: false, error: err.message, code: err.statusCode };
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to send notifications.';
        return { success: false, error: errorMessage };
    }
}

// ── Action: fetch delivery stats ──────────────────────────────────────────────

export async function fetchNotificationStats(
    notificationId: string,
): Promise<ActionResult<NotificationStats>> {
    try {
        await requireAuth();

        if (!notificationId) {
            return { success: false, error: 'Missing notification ID.' };
        }

        const stats = await getNotificationStats(notificationId);
        return { success: true, data: stats };
    } catch (err) {
        if (err instanceof OneSignalError) {
            return { success: false, error: err.message, code: err.statusCode };
        }
        return { success: false, error: 'Failed to fetch stats.' };
    }
}

// ── Action: notify + revalidate a Next.js page/tag ───────────────────────────
// Use this when a data mutation should both notify users AND invalidate cached UI.
// Uses revalidateTag() for cache invalidation.

export async function notifyAndRevalidate({
                                              clerkUserId,
                                              heading,
                                              message,
                                              url,
                                              revalidatePathValue,
                                              revalidateTagValue,
                                          }: {
    clerkUserId: string;
    heading: string;
    message: string;
    url?: string;
    revalidatePathValue?: string;
    revalidateTagValue?: string;
}): Promise<ActionResult<{ notificationId: string }>> {
    try {
        await requireAuth();

        const result = await sendPushNotification({
            heading,
            message,
            url,
            target: { type: 'external_ids', ids: [clerkUserId] },
        });

        // Revalidate Next.js cache so the UI reflects the change immediately
        // updateTag() (Next.js 16) gives read-your-writes semantics within the same request
        if (revalidatePathValue) revalidatePath(revalidatePathValue);
        if (revalidateTagValue) revalidateTag(revalidateTagValue,"");

        return { success: true, data: { notificationId: result.id } };
    } catch (err) {
        if (err instanceof OneSignalError) {
            return { success: false, error: err.message, code: err.statusCode };
        }
        return { success: false, error: 'Failed to notify and revalidate.' };
    }
}