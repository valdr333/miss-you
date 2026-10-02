self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || '',
        icon: '/icon-192.png',
        data: { url: '/' },
    };
    if (data.kind === 'sos') {
        options.requireInteraction = true;          // stays until dismissed
        options.vibrate = [300, 100, 300, 100, 600];
        options.tag = 'sos';                        // a new SOS replaces the old one...
        options.renotify = true;                    // ...but still buzzes again
    }
    event.waitUntil(self.registration.showNotification(data.title || 'Miss You', options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windows.length > 0) return windows[0].focus();
        return self.clients.openWindow(event.notification.data.url);
    })());
});