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

    // ── 1. Initialise OneSignal once on mount ────────────────────────────
    useEffect(() => {
        initOneSignal()
            .then(() => setIsInitialized(true))
            .catch((err) => console.error('[OneSignal] Init failed:', err));
    }, []);

    // ── 2. Link / tag the Clerk user whenever auth state changes ─────────
    useEffect(() => {
        if (!isInitialized || !isLoaded) return;

        if (user) {
            if (previousUserIdRef.current === user.id) return;
            previousUserIdRef.current = user.id;

            OneSignal.login(user.id)
                .then(() => {
                    // ── Base identity tags ─────────────────────────────
                    const baseTags: Record<string, string> = {
                        clerk_user_id: user.id,
                    };

                    // ── Requisition role tags ──────────────────────────
                    // publicMetadata.requisitionRole is string[] e.g. ['requestor','reviewer']
                    // Each role becomes an independent boolean tag so OneSignal
                    // filters can target "all reviewers", "all approvers", etc.
                    const roles =
                        (user.publicMetadata?.requisitionRole as string[] | undefined) ?? [];

                    const roleTags = roles.reduce<Record<string, string>>(
                        (acc, role) => ({ ...acc, [role]: 'true' }),
                        {},
                    );

                    // Merge and strip blank values
                    const allTags = Object.fromEntries(
                        Object.entries({ ...baseTags, ...roleTags }).filter(
                            (entry): entry is [string, string] =>
                                typeof entry[1] === 'string' && entry[1].length > 0,
                        ),
                    );

                    return OneSignal.User.addTags(allTags);
                })
                .catch((err) => console.error('[OneSignal] Login/tag error:', err));
        } else if (previousUserIdRef.current !== null) {
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