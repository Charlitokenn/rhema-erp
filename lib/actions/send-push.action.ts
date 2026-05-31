// Send to a specific Clerk user
await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        heading: 'Hello!',
        message: 'Your order has shipped.',
        url: 'https://yourapp.com/orders/123',
        target: { type: 'external_ids', ids: ['clerk_user_id_here'] },
    }),
});

// Send to a OneSignal segment (e.g. "Active Users")
await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        heading: 'New feature!',
        message: "Check out what's new.",
        target: { type: 'segments', names: ['Active Users'] },
    }),
});