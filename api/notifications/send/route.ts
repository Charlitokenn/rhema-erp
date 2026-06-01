// src/app/api/notifications/send/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendPushNotification, OneSignalError } from '@/lib/onesignal-server';
import type { SendNotificationRequest } from '@/types/onesignal';
import { z } from 'zod';

const sendNotificationSchema = z.object({
    heading: z.string().min(1, 'Heading is required'),
    message: z.string().min(1, 'Message is required'),
    url: z.string().url().optional(),
    imageUrl: z.string().url().optional(),
    data: z.record(z.string(), z.string()).optional(),
    target: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('external_ids'),
            ids: z.array(z.string()),
        }),
        z.object({
            type: z.literal('segments'),
            names: z.array(z.string()),
        }),
        z.object({
            type: z.literal('subscription_ids'),
            ids: z.array(z.string()),
        }),
    ]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const rawBody = await request.json();
        const parseResult = sendNotificationSchema.safeParse(rawBody);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: parseResult.error.format() },
                { status: 400 }
            );
        }

        const body: SendNotificationRequest = parseResult.data;
        const result = await sendPushNotification(body);
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