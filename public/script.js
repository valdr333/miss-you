const KEY = 'missyou.settings';

function slug(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadSettings() {
    try {
        return JSON.parse(localStorage.getItem(KEY));
    } catch {
        return null;
    }
}

function saveSettings(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
}

const setupEl = document.getElementById('setup');
const homeEl = document.getElementById('home');
const formEl = document.getElementById('setup-form');
let settings = loadSettings();

function showScreen() {
    const ready = Boolean(settings && settings.base && settings.me && settings.partner);
    setupEl.hidden = ready;
    homeEl.hidden = !ready;
}

formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formEl));
    settings = { me: data.me.trim(), partner: data.partner.trim(), base: data.base.trim() };
    saveSettings(settings);
    getLocation();
    showScreen();
    setupPush();
});

document.getElementById('edit').addEventListener('click', () => {
    // Pre-fill the form so you don't have to retype everything
    if (settings) {
        formEl.elements.me.value = settings.me;
        formEl.elements.partner.value = settings.partner;
        formEl.elements.base.value = settings.base;
    }
    setupEl.hidden = false;
    homeEl.hidden = true;
});

showScreen();

async function sendPing(kind, extra = {}) {
    const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pair: slug(settings.base),
            fromName: settings.me,
            to: slug(settings.partner),
            kind,
            ...extra,
        }),
    });
    if (res.status === 404 || res.status === 410) {
        const err = new Error('partner not subscribed');
        err.userMessage = `${settings.partner} hasn't turned on notifications yet`;
        throw err;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
}

const COOLDOWN_MS = 500;
const statusEl = document.getElementById('status');
const buttons = document.querySelectorAll('.ping');

buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
        buttons.forEach((b) => (b.disabled = true));
        statusEl.textContent = 'Sending...';
        try {
            await sendPing(btn.dataset.kind);
            statusEl.textContent = 'Sent 🪐🤍';
            navigator.vibrate?.(50);
        } catch (err) {
            console.error(err);
            statusEl.textContent = err.userMessage || 'Could not send. Check your connection and try again.';
        } finally {
            setTimeout(() => {
                buttons.forEach((b) => (b.disabled = false));
            }, COOLDOWN_MS);
        }
    });
});

const VAPID_PUBLIC_KEY = 'BCXPuFfiBvVPP-ZE0XEIU1akysTFHShYp8KnlfBfhYz7G51gKrfKrvX8r-OKOG3pmJnHikX9toUJdNR5VlZ6Zwc';
const enableBtn = document.getElementById('enable-push');

function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function saveSubscription(subscription) {
    await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: slug(settings.base), name: slug(settings.me), subscription }),
    });
}

// Until notifications are on, hide the ping buttons and show only the enable button
function setPushReady(ready) {
    homeEl.classList.toggle('needs-push', !ready);
    enableBtn.hidden = ready;
    if (!ready) {
        statusEl.textContent = Notification.permission === 'denied'
            ? 'Notifications are off. Turn them on in your phone settings to use the app.'
            : 'Turn on notifications so you never miss a ping 💜';
    }
}

async function setupPush() {
    if (!settings) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        homeEl.classList.add('needs-push');
        enableBtn.hidden = true;
        statusEl.textContent = 'On iPhone, open this app from your Home Screen to get notifications.';
        return;
    }
    try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const existing = await reg.pushManager.getSubscription();
        if (existing && Notification.permission === 'granted') {
            await saveSubscription(existing);   // refresh it every time the app opens
            setPushReady(true);
        } else {
            setPushReady(false);
        }
    } catch (err) {
        console.error(err);
        setPushReady(false);
    }
}

enableBtn.addEventListener('click', async () => {
    // must run directly from a tap, or iPhone refuses to ask
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        setPushReady(false);
        return;
    }
    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await saveSubscription(subscription);
        setPushReady(true);
        statusEl.textContent = 'Notifications are on 🔔';
    } catch (err) {
        console.error(err);
        statusEl.textContent = 'Could not turn on notifications. Try again.';
    }
});

setupPush();

const sosEl = document.getElementById('sos');
const thumb = sosEl.querySelector('.sos-thumb');
let startX = null;
let max = 0;
let progress = 0;
let sending = false;

function setPosition(dx) {
    progress = max > 0 ? dx / max : 0;
    thumb.style.transform = `translateX(${dx}px)`
    sosEl.style.setProperty('--p', progress);
}

function resetSlider() {
    sosEl.classList.remove('dragging');
    setPosition(0);
}

thumb.addEventListener('pointerdown', (e) => {
    if (sending) return;
    startX = e.clientX;
    max = sosEl.clientWidth - thumb.offsetWidth;
    thumb.setPointerCapture(e.pointerId);
    sosEl.classList.add('dragging');
});

thumb.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    let dx = e.clientX - startX;
    dx = Math.max(0, Math.min(dx, max));
    setPosition(dx);
});

function endDrag(e) {
    if (startX === null) return;
    startX = null;
    if (e.type === 'pointerup' && progress > 0.95) {
        sendSOS();
    } else {
        resetSlider();
    }
}

thumb.addEventListener('pointerup', endDrag);
thumb.addEventListener('pointercancel', endDrag);

async function sendSOS() {
    sending = true;
    statusEl.textContent = 'Getting location...';
    const coords = await getLocation();
    statusEl.textContent = 'Sending SOS...';
    try {
        await sendPing('sos', coords ? coords : {});
        if (coords === null) {
            statusEl.textContent = `🚨 SOS sent (no location)`;
        } else {
            statusEl.textContent = `🚨 SOS sent with your location`;
        }
        navigator.vibrate?.([100, 50, 100]);
    } catch (err) {
        console.error(err);
        statusEl.textContent = `SOS didn't send. Call ${settings.partner} directly.`;
    } finally {
        setTimeout(() => {
            sending = false;
            resetSlider();
        }, 1000);
    }
}

function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({lat: pos.coords.latitude, lng: pos.coords.longitude}),
            () => resolve(null),
            {enableHighAccuracy: true, timeout: 5000, maximumAge: 60000},
        );
    });
}