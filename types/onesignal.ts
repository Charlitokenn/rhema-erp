export type PushPermission = 'default' | 'granted' | 'denied';

export interface OneSignalUserTags {
    clerk_user_id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    plan?: string;
    environment?: string;
    // Requisition role tags — set by onesignal-provider.tsx
    requestor?: 'true';
    reviewer?: 'true';
    approver?: 'true';
    [key: string]: string | undefined;
}

// ── Filter targeting (OneSignal API v11 /notifications) ───────────────────────
export type OneSignalFilter =
    | { field: 'tag'; key: string; relation: '=' | '!=' | '>' | '<'; value: string }
    | { operator: 'AND' | 'OR' };

export interface SendNotificationRequest {
    heading: string;
    message: string;
    url?: string;
    imageUrl?: string;
    data?: Record<string, string>;
    target:
        | { type: 'external_ids'; ids: string[] }
        | { type: 'segments'; names: string[] }
        | { type: 'subscription_ids'; ids: string[] }
        | { type: 'filters'; filters: OneSignalFilter[] }; // ← new
}

export interface SendNotificationResponse {
    id: string;
    recipients: number;
    external_id?: string;
    errors?: string[] | Record<string, string[]>;
}

export interface NotificationStats {
    id: string;
    headings?: { en: string };
    contents?: { en: string };
    sent?: number;
    confirmed?: number;
    converted?: number;
    errored?: number;
    failed?: number;
    remaining?: number;
    completed_at?: number;
    queued_at?: number;
    target_channel?: string;
}

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