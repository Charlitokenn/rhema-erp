import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {OneSignalError, deleteSubscription, deleteUserByExternalId} from '@/lib/onesignal-server';
import { z } from 'zod';

const schema = z.object({
    subscriptionId: z.string().optional(),
    externalId: z.string().optional(),
}).refine((data) => data.subscriptionId || data.externalId, {
    message: 'Either subscriptionId or externalId is required',
});

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { subscriptionId, externalId } = schema.parse(body);

        if (subscriptionId) {
            await deleteSubscription(subscriptionId);
            return NextResponse.json({ success: true, method: 'deleted' });
        }

        if (externalId) {
            await deleteUserByExternalId(externalId);
            return NextResponse.json({ success: true, method: 'deleted_all' });
        }
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