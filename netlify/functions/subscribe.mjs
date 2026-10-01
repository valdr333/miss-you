import { getStore } from '@netlify/blobs';

export default async (req) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const { pair, name, subscription } = await req.json();
    if (!pair || !name || !subscription?.endpoint) {
        return new Response('Missing data', { status: 400 });
    }

    await getStore('subscriptions').setJSON(`${pair}__${name}`, subscription);
    return new Response('ok');
};

export const config = { path: '/api/subscribe' };