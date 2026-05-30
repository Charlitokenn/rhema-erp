// src/lib/onesignal-server.ts
// Pure server-side utility — never import this in client components.
// No 'use server' here — it's a regular server module.
import type {
    SendNotificationRequest,
    SendNotificationResponse,
    NotificationStats,
} from '@/types/onesignal';

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

    const data: SendNotificationResponse = await res.json();

    if (!res.ok) {
        throw new OneSignalError(
            `OneSignal API error ${res.status}`,
            res.status,
            data,
        );
    }

    return data;
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

    const data: NotificationStats = await res.json();

    if (!res.ok) {
        throw new OneSignalError(
            `OneSignal stats error ${res.status}`,
            res.status,
            data,
        );
    }

    return data;
}

// ── Custom error class ────────────────────────────────────────────────────────

export class OneSignalError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly details: unknown,
    ) {
        super(message);
        this.name = 'OneSignalError';
    }
}