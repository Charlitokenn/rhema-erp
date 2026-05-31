'use client';

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useUser } from '@clerk/nextjs';
import OneSignal from 'react-onesignal';
import { initOneSignal } from '@/lib/onesignal';

interface OneSignalContextValue {
    isInitialized: boolean;
}

const OneSignalContext = createContext<OneSignalContextValue>({
    isInitialized: false,
});

export function useOneSignalContext(): OneSignalContextValue {
    return useContext(OneSignalContext);
}

export function OneSignalProvider({ children }: { children: ReactNode }) {
    const { user, isLoaded } = useUser();
    const [isInitialized, setIsInitialized] = useState(false);
    const previousUserIdRef = useRef<string | null>(null);

    // ── 1. Initialize OneSignal once on mount ───────────────────────────────
    useEffect(() => {
        initOneSignal()
            .then(() => setIsInitialized(true))
            .catch((err) => console.error('[OneSignal] Init failed:', err));
    }, []);

    // ── 2. Link / unlink the Clerk user whenever auth state changes ─────────
    useEffect(() => {
        if (!isInitialized || !isLoaded) return;

        if (user) {
            // Skip if we already logged in this user on this page load
            if (previousUserIdRef.current === user.id) return;
            previousUserIdRef.current = user.id;

            // login() sets the External ID = Clerk userId, linking this device's
            // push subscription to the authenticated user profile in OneSignal.
            OneSignal.login(user.id)
                .then(() => {
                    // Build tags — only send non-identifying segmentation keys
                    const tags = Object.fromEntries(
                        Object.entries({
                            clerk_user_id: user.id,
                            environment: process.env.NODE_ENV,
                        }).filter(
                            (entry): entry is [string, string] =>
                                typeof entry[1] === 'string' && entry[1].length > 0,
                        ),
                    );
                    return OneSignal.User.addTags(tags);
                })
                .catch((err) => console.error('[OneSignal] Login/tag error:', err));
        } else if (previousUserIdRef.current !== null) {
            // User signed out — unlink the push subscription from their profile
            previousUserIdRef.current = null;
            OneSignal.logout().catch((err) =>
                console.error('[OneSignal] Logout error:', err),
            );
        }
    }, [isInitialized, isLoaded, user]);

    return (
        <OneSignalContext.Provider value={{ isInitialized }}>
            {children}
        </OneSignalContext.Provider>
    );
}