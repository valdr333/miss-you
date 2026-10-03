self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || '',
        icon: '/icon-192.png',
        data: { url: data.url || '/', point: data.point },
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
    const url = event.notification.data.url;
    if (url !== '/') {
        // Try the Google Maps app first; if the phone refuses, open the web map
        const point = event.notification.data.point;
        const ua = navigator.userAgent;
        let appUrl = null;
        if (/android/i.test(ua)) {
            appUrl = `intent://www.google.com/maps/search/?api=1&query=${point}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
        } else if (/iPhone|iPad|iPod/.test(ua)) {
            appUrl = `comgooglemaps://?q=${point}&zoom=14`;
        }
        if (point && appUrl) {
            event.waitUntil(self.clients.openWindow(appUrl).catch(() => self.clients.openWindow(url)));
        } else {
            event.waitUntil(self.clients.openWindow(url));
        }
        return;
    }
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windows.length > 0) return windows[0].focus();
        return self.clients.openWindow(url);
    })());
});