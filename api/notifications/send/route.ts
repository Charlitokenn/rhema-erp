// src/app/api/notifications/send/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendPushNotification, OneSignalError } from '@/lib/onesignal-server';
import type { SendNotificationRequest } from '@/types/onesignal';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body: SendNotificationRequest = await request.json();
        const result = await sendPushNotification(body); // ← same utility
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof OneSignalError) {
            return NextResponse.json(
                { error: err.message, details: err.details },
                { status: err.statusCode },
            );
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}