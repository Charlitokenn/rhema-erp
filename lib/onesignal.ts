import OneSignal from 'react-onesignal';

let initialized = false;

export async function initOneSignal(): Promise<void> {
    if (initialized || typeof window === 'undefined') return;

    await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
        // Keep the path, but restrict scope to /oneSignal/ so it
        // doesn't compete with the PWA service worker at scope /
        serviceWorkerPath: 'oneSignal/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/oneSignal/' },
        autoResubscribe: true,
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
            }},
        welcomeNotification: { disable: true, message: "" },
    });

    initialized = true;
}