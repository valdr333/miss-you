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

function topicsFor(s) {
    const base = slug(s.base);
    return {
        mine: `${base}-${slug(s.me)}`,
        theirs: `${base}-${slug(s.partner)}`,
    };
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
    showScreen();
    // startListening(); // add back once you build step 6 (in-page banner)
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

const MESSAGES = {
    miss: { title: '💌 {me} misses you', body: 'Just a little nudge', priority: 3 },
    checkin: { title: '🫂 {me} wants you to check in', body: 'Send a hello when you can', priority: 4 },
};

async function sendPing(kind) {
    const m = MESSAGES[kind];
    const res = await fetch('https://ntfy.sh/', {
        method: 'POST',
        body: JSON.stringify({
            topic: topicsFor(settings).theirs,
            title: m.title.replace('{me}', settings.me),
            message: m.body,
            priority: m.priority,
            click: location.href,
        }),
    });
    if (!res.ok) {
        throw new Error(`ntfy returned ${res.status}`);
    }
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
            statusEl.textContent = 'Could not send. Check your connection and try again.';
        } finally {
            setTimeout(() => {
                buttons.forEach((b) => (b.disabled = false));
            }, COOLDOWN_MS);
        }
    });
});
