import webpush from 'web-push';
import { getStore } from '@netlify/blobs';

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
);

const MESSAGES = {
    miss:    { title: '💌 {me} misses you', body: 'Just a little nudge' },
    checkin: { title: '🫂 {me} wants you to check in', body: 'Send a hello when you can' },
};

export default async (req) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const { pair, fromName, to, kind } = await req.json();
    const m = MESSAGES[kind];
    if (!pair || !fromName || !to || !m) return new Response('Missing data', { status: 400 });

    const store = getStore('subscriptions');
    const key = `${pair}__${to}`;
    const subscription = await store.get(key, { type: 'json' });
    if (!subscription) return new Response('Partner has not enabled notifications', { status: 404 });

    const payload = JSON.stringify({
        title: m.title.replace('{me}', fromName.slice(0, 20)),
        body: m.body,
    });

    try {
        await webpush.sendNotification(subscription, payload, {
            TTL: 60 * 60 * 24,   // keep trying for a day if her phone is offline
            urgency: 'high',     // deliver right away, even in battery saver
        });
    } catch (err) {
        // 404/410 = this push address no longer exists
        if (err.statusCode === 404 || err.statusCode === 410) {
            await store.delete(key);
            return new Response('Partner needs to enable notifications again', { status: 410 });
        }
        console.error(err);
        return new Response('Push failed', { status: 502 });
    }

    return new Response('ok');
};

export const config = { path: '/api/ping' };