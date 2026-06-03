'use server';

import { auth } from '@clerk/nextjs/server';
import { deleteUserByExternalId } from '@/lib/onesignal-server';
import {OneSignalError} from "@/types/onesignal";

interface UnsubscribeResult {
    success: boolean;
    error?: string;
}

export async function unsubscribeUser(): Promise<UnsubscribeResult> {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        await deleteUserByExternalId(userId);
        return { success: true };
    } catch (err) {
        if (err instanceof OneSignalError) {
            // 404 means the user doesn't exist in OneSignal — treat as already unsubscribed
            if (err.statusCode === 404) {
                return { success: true };
            }
            return { success: false, error: err.message };
        }
        return { success: false, error: 'Internal server error' };
    }
}