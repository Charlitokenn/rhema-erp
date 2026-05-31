import OneSignal from 'react-onesignal';

let initialized = false;

/**
 * Idempotent OneSignal initializer.
 * Call once from the Provider — safe to call multiple times.
 */
export async function initOneSignal(): Promise<void> {
    if (initialized || typeof window === 'undefined') return;

    await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
        // Service worker in a subdirectory; the header in next.config.ts lets it control all pages
        serviceWorkerPath: 'oneSignal/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
        // Auto-resubscribe users who cleared cache or migrated
        autoResubscribe: true,
        // Disable the built-in bell and auto-prompts — we use our own toggle
        notifyButton: { enable: false },
        welcomeNotification: { disable: true },
    });

    initialized = true;
}