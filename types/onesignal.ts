export type PushPermission = 'default' | 'granted' | 'denied';

export interface OneSignalUserTags {
    clerk_user_id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    plan?: string;
    environment?: string;
    [key: string]: string | undefined;
}

export interface SendNotificationRequest {
    heading: string;
    message: string;
    url?: string;
    imageUrl?: string;
    data?: Record<string, string>;
    target:
        | { type: 'external_ids'; ids: string[] }
        | { type: 'segments'; names: string[] }
        | { type: 'subscription_ids'; ids: string[] };
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
    confirmed?: number;  // Delivery receipts — Chrome/Edge only, paid plan required
    converted?: number;  // Clicked
    errored?: number;
    failed?: number;
    remaining?: number;
    completed_at?: number;
    queued_at?: number;
    target_channel?: string;
}