// src/components/notification-toggle.tsx
'use client';

import { useState } from 'react';
import { useOneSignalContext } from '@/components/providers/onesignal-provider';
import { useOneSignal } from '@/hooks/use-onesignal';
import {unsubscribeUser} from "@/lib/actions/unsubscribe.action";

interface NotificationToggleProps {
    className?: string;
    label?: string;
}

export function NotificationToggle({
                                       className = '',
                                       label = 'Push Notifications',
                                   }: NotificationToggleProps) {
    const { isInitialized } = useOneSignalContext();
    const { isSupported, isLoading, isOptedIn, permission, canAskPermission, subscribe, unsubscribe } =
        useOneSignal();

    const [feedback, setFeedback] = useState<{
        kind: 'success' | 'error';
        message: string;
    } | null>(null);

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (!isInitialized) {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <div className="h-6 w-11 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                <span className="text-sm text-gray-400">Loading…</span>
            </div>
        );
    }

    // ── Unsupported browser ──────────────────────────────────────────────────
    if (!isSupported) {
        return (
            <p className={`text-sm text-gray-500 ${className}`}>
                Push notifications are not supported in this browser.
            </p>
        );
    }

    const handleToggle = async () => {
        setFeedback(null);

        if (isOptedIn) {
            // 1. Delete the subscription server-side by Clerk userId (external_id)
            const serverResult = await unsubscribeUser();

            if (!serverResult.success) {
                setFeedback({
                    kind: 'error',
                    message: serverResult.error ?? 'Failed to unsubscribe.',
                });
                return;
            }

            // 2. Update local client state so the UI reflects the change immediately
            const clientResult = await unsubscribe();
            setFeedback(
                clientResult.success
                    ? { kind: 'success', message: 'Push notifications disabled.' }
                    : { kind: 'error', message: clientResult.error ?? 'Something went wrong.' },
            );
        } else {
            const result = await subscribe();
            setFeedback(
                result.success
                    ? { kind: 'success', message: 'Push notifications enabled!' }
                    : { kind: 'error', message: result.error ?? 'Something went wrong.' },
            );
        }
    }

    const statusText =
        permission === 'denied'
            ? 'Blocked by browser — go to Site Settings → Notifications to allow.'
            : isOptedIn
                ? 'You will receive push notifications on this device.'
                : 'Enable to receive push notifications on this device.';

    const isDisabled = isLoading || !canAskPermission;

    return (
        <div className={className}>
            <div className="flex items-start justify-between gap-4">
                {/* Label + description */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{statusText}</p>
                </div>

                {/* Toggle switch — ARIA role="switch" for accessibility */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={isOptedIn}
                    aria-label={`${isOptedIn ? 'Disable' : 'Enable'} push notifications`}
                    onClick={handleToggle}
                    disabled={isDisabled}
                    className={[
                        'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent',
                        'transition-colors duration-200 ease-in-out',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        isOptedIn
                            ? 'bg-blue-600'
                            : 'bg-gray-300 dark:bg-gray-600',
                    ].join(' ')}
                >
          <span
              aria-hidden="true"
              className={[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0',
                  'transition-transform duration-200 ease-in-out',
                  isOptedIn ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
          />
                </button>
            </div>

            {/* Feedback message */}
            {feedback && (
                <p
                    className={[
                        'mt-2 text-xs',
                        feedback.kind === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400',
                    ].join(' ')}
                >
                    {feedback.message}
                </p>
            )}
        </div>
    );
}