'use client';

import { useState, useEffect, useCallback } from 'react';
import OneSignal from 'react-onesignal';
import { useOneSignalContext } from '@/components/providers/onesignal-provider';
import type { PushPermission } from '@/types/onesignal';

export interface UseOneSignalReturn {
    /** True when the SDK is fully initialized */
    isInitialized: boolean;
    /** True if this browser supports web push */
    isSupported: boolean;
    /** True while subscribe() / unsubscribe() is in-flight */
    isLoading: boolean;
    /** Current browser notification permission */
    permission: PushPermission;
    /** True if the user has opted into OneSignal push */
    isOptedIn: boolean;
    /** OneSignal subscription ID for this device */
    subscriptionId: string | undefined;
    /** False when permission is 'denied' — can't prompt again programmatically */
    canAskPermission: boolean;
    /** Request browser permission then opt into OneSignal */
    subscribe: () => Promise<{ success: boolean; error?: string }>;
    /** Opt out of OneSignal push (does not revoke browser permission) */
    unsubscribe: () => Promise<{ success: boolean; error?: string }>;
}

// These types aren't always exported from react-onesignal — define locally
type SubscriptionChangeEvent = {
    current: { optedIn: boolean; id?: string; token?: string };
};

export function useOneSignal(): UseOneSignalReturn {
    const { isInitialized } = useOneSignalContext();
    const [isLoading, setIsLoading] = useState(false);
    const [permission, setPermission] = useState<PushPermission>('default');
    const [isOptedIn, setIsOptedIn] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState<string | undefined>();
    const [isSupported, setIsSupported] = useState(false);

    // ── Read current SDK state ───────────────────────────────────────────────
    const syncState = useCallback(() => {
        try {
            setIsSupported(OneSignal.Notifications.isPushSupported());
            // OneSignal.Notifications.permission is a boolean, not a string
            // Map: undefined -> 'default', true -> 'granted', false -> 'denied'
            const permValue = OneSignal.Notifications.permission;
            const mappedPerm: PushPermission =
                permValue === undefined ? 'default' :
                permValue === true ? 'granted' : 'denied';
            setPermission(mappedPerm);
            setIsOptedIn(OneSignal.User.PushSubscription.optedIn ?? false);
            setSubscriptionId(OneSignal.User.PushSubscription.id ?? undefined);
        } catch {
            // Silently ignore if SDK isn't ready yet
        }
    }, []);

    // Initial sync once initialized
    useEffect(() => {
        if (!isInitialized) return;
        syncState();
    }, [isInitialized, syncState]);

    // ── SDK event listeners ──────────────────────────────────────────────────
    useEffect(() => {
        if (!isInitialized) return;

        const handleSubscriptionChange = (event: SubscriptionChangeEvent) => {
            setIsOptedIn(event.current.optedIn ?? false);
            setSubscriptionId(event.current.id ?? undefined);
        };

        // 'permissionChange' passes true = granted, false = denied
        const handlePermissionChange = (granted: boolean) => {
            setPermission(granted ? 'granted' : 'denied');
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (OneSignal.User.PushSubscription as any).addEventListener(
            'change',
            handleSubscriptionChange,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (OneSignal.Notifications as any).addEventListener(
            'permissionChange',
            handlePermissionChange,
        );

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (OneSignal.User.PushSubscription as any).removeEventListener(
                'change',
                handleSubscriptionChange,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (OneSignal.Notifications as any).removeEventListener(
                'permissionChange',
                handlePermissionChange,
            );
        };
    }, [isInitialized]);

    // ── Subscribe ────────────────────────────────────────────────────────────
    const subscribe = useCallback(async (): Promise<{
        success: boolean;
        error?: string;
    }> => {
        if (!isInitialized) {
            return { success: false, error: 'Notifications not ready. Please try again.' };
        }
        if (permission === 'denied') {
            return {
                success: false,
                error:
                    'Notifications are blocked by your browser. Go to Site Settings → Notifications and allow this site.',
            };
        }

        try {
            setIsLoading(true);

            // Request browser-level permission if not already granted
            if (permission !== 'granted') {
                await OneSignal.Notifications.requestPermission();
            }

            // Map the boolean permission to PushPermission string
            const permValue = OneSignal.Notifications.permission;
            const newPerm: PushPermission =
                permValue === undefined ? 'default' :
                permValue === true ? 'granted' : 'denied';
            setPermission(newPerm);

            if (newPerm !== 'granted') {
                return { success: false, error: 'Notification permission was not granted.' };
            }

            await OneSignal.User.PushSubscription.optIn();
            syncState();
            return { success: true };
        } catch (err) {
            console.error('[OneSignal] Subscribe error:', err);
            return { success: false, error: 'Could not enable notifications. Please try again.' };
        } finally {
            setIsLoading(false);
        }
    }, [isInitialized, permission, syncState]);

    // ── Unsubscribe ──────────────────────────────────────────────────────────
    const unsubscribe = useCallback(async (): Promise<{
        success: boolean;
        error?: string;
    }> => {
        if (!isInitialized) {
            return { success: false, error: 'Notifications not ready. Please try again.' };
        }
        try {
            setIsLoading(true);
            await OneSignal.User.PushSubscription.optOut();
            syncState();
            return { success: true };
        } catch (err) {
            console.error('[OneSignal] Unsubscribe error:', err);
            return { success: false, error: 'Could not disable notifications. Please try again.' };
        } finally {
            setIsLoading(false);
        }
    }, [isInitialized, syncState]);

    return {
        isInitialized,
        isSupported,
        isLoading,
        permission,
        isOptedIn,
        subscriptionId,
        canAskPermission: permission !== 'denied',
        subscribe,
        unsubscribe,
    };
}