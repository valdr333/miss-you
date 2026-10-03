self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || '',
        icon: '/icon-192.png',
        data: { point: data.point },
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
    const point = event.notification.data.point;   // only set for an SOS with a location
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windows.length > 0) {
            // App is already open: tell it to show the SOS popup
            if (point) windows[0].postMessage({ type: 'sos', point });
            return windows[0].focus();
        }
        // App is closed: start it, with the location in the URL
        return self.clients.openWindow(point ? `/?sos=${point}` : '/');
    })());
});