import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import type { NotificationStats } from '@/types/onesignal';

export async function GET(
    _request: NextRequest,
    // Next.js 15: params is a Promise
    { params }: { params: Promise<{ notificationId: string }> },
): Promise<NextResponse> {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { notificationId } = await params;
        if (!notificationId) {
            return NextResponse.json({ error: 'Missing notification ID' }, { status: 400 });
        }

        const url = new URL(
            `https://api.onesignal.com/notifications/${notificationId}`,
        );
        url.searchParams.set('app_id', process.env.ONESIGNAL_APP_ID!);

        const osRes = await fetch(url.toString(), {
            headers: {
                Authorization: `Key ${process.env.ONESIGNAL_API_KEY!}`,
            },
            // Revalidate every 30 s — confirmed delivery trickles in over time
            next: { revalidate: 30 },
        });

        const data: NotificationStats = await osRes.json();

        if (!osRes.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch stats', details: data },
                { status: osRes.status },
            );
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error('[OneSignal] Stats route error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}