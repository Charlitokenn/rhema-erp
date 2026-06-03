"use server";

// src/lib/onesignal-server.ts
// Pure server-side utility — never import this in client components.
// No 'use server' here — it's a regular server module.
import {
    SendNotificationRequest,
    SendNotificationResponse,
    NotificationStats, OneSignalError,
} from '@/types/onesignal';
import {auth} from "@clerk/nextjs/server";

export type DisableSubscriptionResult =
    | { success: true; disabled: number }
    | { success: false; error: string };

const ONESIGNAL_API_BASE = 'https://api.onesignal.com';

function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function buildPayload(req: SendNotificationRequest): Record<string, unknown> {
    const base: Record<string, unknown> = {
        app_id: getEnvVar('ONESIGNAL_APP_ID'),
        target_channel: 'push',
        headings: { en: req.heading },
        contents: { en: req.message },
        ...(req.url && { url: req.url }),
        ...(req.data && { data: req.data }),
        ...(req.imageUrl && {
            chrome_web_image: req.imageUrl,
            firefox_icon: req.imageUrl,
        }),
    };

    switch (req.target.type) {
        case 'external_ids':
            return {
                ...base,
                include_aliases: { external_id: req.target.ids },
            };
        case 'segments':
            return { ...base, included_segments: req.target.names };
        case 'subscription_ids':
            return { ...base, include_subscription_ids: req.target.ids };
        // ── New: role/tag-based filter targeting ──────────────────────────
        case 'filters':
            return { ...base, filters: req.target.filters };
        default:
            throw new Error(`Unsupported target type: ${(req.target as never)}`);
    }
}

/**
 * Send a push notification via OneSignal REST API.
 * Safe to call from Server Actions, Route Handlers, and other server-side code.
 */
export async function sendPushNotification(
    req: SendNotificationRequest,
): Promise<SendNotificationResponse> {
    const payload = buildPayload(req);

    const res = await fetch(`${ONESIGNAL_API_BASE}/notifications`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${getEnvVar('ONESIGNAL_API_KEY')}`,
        },
        body: JSON.stringify(payload),
        // Never cache notification sends
        cache: 'no-store',
    });

    // Read raw response first
    const rawText = await res.text();

    if (!res.ok) {
        // Try to parse as JSON, fall back to raw text
        let errorData: unknown;
        try {
            errorData = JSON.parse(rawText);
        } catch {
            errorData = rawText;
        }
        throw new OneSignalError(
            `OneSignal API error ${res.status}`,
            res.status,
            errorData,
        );
    }

    // Parse successful response
    try {
        const data: SendNotificationResponse = JSON.parse(rawText);
        return data;
    } catch (err) {
        throw new OneSignalError(
            'Failed to parse OneSignal response',
            res.status,
            rawText,
        );
    }
}

/**
 * Fetch delivery stats for a notification.
 * The `confirmed` field reflects actual device receipt (Chrome/Edge, paid plan only).
 */
export async function getNotificationStats(
    notificationId: string,
): Promise<NotificationStats> {
    const url = new URL(`${ONESIGNAL_API_BASE}/notifications/${notificationId}`);
    url.searchParams.set('app_id', getEnvVar('ONESIGNAL_APP_ID'));

    const res = await fetch(url.toString(), {
        headers: {
            Authorization: `Key ${getEnvVar('ONESIGNAL_API_KEY')}`,
        },
        // Revalidate delivery stats every 30 seconds
        next: { revalidate: 30 },
    });

    // Read raw response first
    const rawText = await res.text();

    if (!res.ok) {
        // Try to parse as JSON, fall back to raw text
        let errorData: unknown;
        try {
            errorData = JSON.parse(rawText);
        } catch {
            errorData = rawText;
        }
        throw new OneSignalError(
            `OneSignal stats error ${res.status}`,
            res.status,
            errorData,
        );
    }

    // Parse successful response
    try {
        const data: NotificationStats = JSON.parse(rawText);
        return data;
    } catch (err) {
        throw new OneSignalError(
            'Failed to parse OneSignal stats response',
            res.status,
            rawText,
        );
    }
}

/**
 * Hard unsubscribe: permanently delete a subscription (device).
 * The user will stop receiving push notifications on that device.
 * If they re-open the app, a new subscription may be created automatically.
 */
export async function deleteSubscription(subscriptionId: string): Promise<void> {
    const res = await fetch(
        `${ONESIGNAL_API_BASE}/subscriptions/${subscriptionId}`,
        {
            method: 'DELETE',
            headers: {
                Authorization: `Key ${getEnvVar('ONESIGNAL_API_KEY')}`,
            },
        },
    );

    if (!res.ok) {
        const rawText = await res.text();
        let errorData: unknown;
        try { errorData = JSON.parse(rawText); } catch { errorData = rawText; }
        throw new OneSignalError(
            `OneSignal unsubscribe error ${res.status}`,
            res.status,
            errorData,
        );
    }
}

/**
 * Soft unsubscribe: disable a subscription without deleting it.
 * Use this if you want to retain the device record but stop sending notifications.
 * Disable all OneSignal subscriptions for a given Clerk user.
 * Looks up the user by external_id, then PATCHes every subscription
 * to { enabled: false }.
 */
export async function disableSubscription(): Promise<DisableSubscriptionResult> {
    // ── 1. Resolve caller identity ───────────────────────────────────────────
    let userId: string | null = null;
    try {
        const authResult = await auth();
        userId = authResult.userId;
    } catch {
        return { success: false, error: 'Authentication check failed.' };
    }

    if (!userId) {
        return { success: false, error: 'Unauthorized: no active session.' };
    }

    const appId = getEnvVar('ONESIGNAL_APP_ID');
    const apiKey = getEnvVar('ONESIGNAL_API_KEY');

    // ── 2. Resolve user by external_id (Clerk ID) ──────────────────────────
    let userData: { subscriptions?: Array<{ id: string }> };
    try {
        const userRes = await fetch(
            `${ONESIGNAL_API_BASE}/apps/${appId}/users/by/external_id/${encodeURIComponent(userId)}`,
            {
                headers: {
                    Authorization: `Key ${apiKey}`,
                },
            },
        );

    if (!userRes.ok) {
        const rawText = await userRes.text();
        let errorData: unknown;
        try { errorData = JSON.parse(rawText); } catch { errorData = rawText; }
        return {
            success: false,
            error: `OneSignal user lookup error ${userRes.status}: ${JSON.stringify(errorData)}`,
        };
    }

    userData = await userRes.json();
    } catch (err) {
        return {
            success: false,
            error: `Network error during user lookup: ${err instanceof Error ? err.message : String(err)}`,
        };
    }

    const subscriptions = userData.subscriptions ?? [];
    if (subscriptions.length === 0) {
        return { success: true, disabled: 0 };
    }

    // ── 3. Disable every subscription found ──────────────────────────────────
    let disabled = 0;
    const failures: string[] = [];

    for (const sub of subscriptions) {
        try {
            const res = await fetch(
                `${ONESIGNAL_API_BASE}/apps/${appId}/subscriptions/${sub.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Key ${apiKey}`,
                    },
                    body: JSON.stringify({ enabled: false }),
                },
            );

            if (!res.ok) {
                const rawText = await res.text();
                let errorData: unknown;
                try { errorData = JSON.parse(rawText); } catch { errorData = rawText; }
                failures.push(`subscription ${sub.id}: ${JSON.stringify(errorData)}`);
            } else {
                disabled++;
            }
        } catch (err) {
            failures.push(
                `subscription ${sub.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    // ── 4. Surface partial or total failures ─────────────────────────────────
    if (disabled === 0 && failures.length > 0) {
        return {
            success: false,
            error: `All ${failures.length} subscription disable attempts failed. ${failures.join('; ')}`,
        };
    }

    if (failures.length > 0) {
        // Partial success: some were disabled, some failed.
        // Still return success:true so the client knows work was done,
        // but include the failure details in a console warning server-side.
        console.warn(
            '[disableSubscription] partial failure:',
            { disabled, failed: failures.length, details: failures },
        );
    }

    return { success: true, disabled };
}

/**
 * Delete a user (and ALL their subscriptions) by external_id.
 * This is the correct v11 API endpoint.
 */
export async function deleteUserByExternalId(externalId: string): Promise<void> {
    const appId = getEnvVar('ONESIGNAL_APP_ID');
    const url = `${ONESIGNAL_API_BASE}/apps/${appId}/users/by/external_id/${externalId}`;

    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            Authorization: `Key ${getEnvVar('ONESIGNAL_API_KEY')}`,
        },
    });

    // 202 = accepted (async deletion), 404 = user not found
    if (!res.ok && res.status !== 404) {
        const rawText = await res.text();
        let errorData: unknown;
        try { errorData = JSON.parse(rawText); } catch { errorData = rawText; }
        throw new OneSignalError(
            `OneSignal delete user error ${res.status}`,
            res.status,
            errorData,
        );
    }
}