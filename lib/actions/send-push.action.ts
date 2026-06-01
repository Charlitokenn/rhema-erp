export async function sendToClerkUser(userId: string) {
    return await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            heading: 'Hello!',
            message: 'Your order has shipped.',
            url: 'https://yourapp.com/orders/123',
            target: { type: 'external_ids', ids: [userId] },
        }),
    });
}