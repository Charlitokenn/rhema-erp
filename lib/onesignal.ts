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
        notifyButton: { enable: false, prenotify: false, showCredit: false, text: {
                "dialog.blocked.message": "",
                "dialog.blocked.title": "",
                "dialog.main.button.subscribe": "",
                "dialog.main.button.unsubscribe": "",
                "dialog.main.title": "",
                "message.action.resubscribed": "",
                "message.action.subscribed": "",
                "message.action.subscribing": "",
                "message.action.unsubscribed": "",
                "message.prenotify": "",
                "tip.state.blocked": "",
                "tip.state.subscribed": "",
                "tip.state.unsubscribed": ""
            } },
        welcomeNotification: {
            disable: true,
            message: ""
        },
    });

    initialized = true;
}