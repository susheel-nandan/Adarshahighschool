// ─── Toast Notifications ───────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
}

// ─── API Helper ────────────────────────────────────────────────────
async function api(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ─── Auth Check ────────────────────────────────────────────────────
async function checkSession() {
    try {
        const data = await api('GET', '/api/auth/session');
        return data;
    } catch { return { loggedIn: false }; }
}

async function requireAuth(expectedRole) {
    const session = await checkSession();
    if (!session.loggedIn) { window.location.href = '/login.html'; return null; }
    if (expectedRole && session.role !== expectedRole) {
        window.location.href = session.role === 'student' ? '/student/dashboard.html' : '/parent/dashboard.html';
        return null;
    }
    return session;
}

async function logout() {
    await api('POST', '/api/auth/logout');
    window.location.href = '/login.html';
}

// ─── Sidebar Active Link ───────────────────────────────────────────
function setActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.href && path.includes(el.dataset.href)) {
            el.classList.add('active');
        }
    });
}

// ─── Sidebar Toggle (mobile) ───────────────────────────────────────
function initSidebar() {
    const toggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
    });
    if (overlay) overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    });
}

// ─── Nav Navigation ───────────────────────────────────────────────
function initNav() {
    document.querySelectorAll('.nav-item[data-href]').forEach(el => {
        el.addEventListener('click', () => { window.location.href = el.dataset.href; });
    });
    document.querySelector('.btn-logout')?.addEventListener('click', async () => {
        await logout();
    });
}

// ─── Page Loader ──────────────────────────────────────────────────
function hideLoader() {
    const l = document.getElementById('page-loader');
    if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 400); }
}

// ─── Format Date ──────────────────────────────────────────────────
function fmtDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
}

// ─── Get Grade ────────────────────────────────────────────────────
function getGrade(pct) {
    if (pct >= 90) return { grade: 'A+', cls: 'grade-A' };
    if (pct >= 80) return { grade: 'A', cls: 'grade-A' };
    if (pct >= 70) return { grade: 'B+', cls: 'grade-B' };
    if (pct >= 60) return { grade: 'B', cls: 'grade-B' };
    if (pct >= 50) return { grade: 'C', cls: 'grade-C' };
    if (pct >= 40) return { grade: 'D', cls: 'grade-D' };
    return { grade: 'F', cls: 'grade-F' };
}

// ─── Countdown Days ───────────────────────────────────────────────
function countdownDays(dateStr) {
    const diff = new Date(dateStr) - new Date('2026-02-28');
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Past';
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow!';
    return `${days} days`;
}

// ─── Set User Info in Sidebar ─────────────────────────────────────
function setUserInfo(name, role) {
    const avatar = document.querySelector('.user-avatar');
    const uname = document.querySelector('.user-name');
    const urole = document.querySelector('.user-role');
    if (avatar) avatar.textContent = (name || '?')[0].toUpperCase();
    if (uname) uname.textContent = name || '';
    if (urole) urole.textContent = role || '';
}
