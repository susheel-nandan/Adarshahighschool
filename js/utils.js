// ─── Theme Initialization ──────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();

function setTheme(themeName) {
    localStorage.setItem('theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
}

function handleThemeToggle(checkbox) {
    setTheme(checkbox.checked ? 'dark' : 'light');
}

function getThemeToggleHTML() {
    const isDark = (localStorage.getItem('theme') === 'dark');
    return `
      <div class="theme-switch-wrapper" style="display:flex;align-items:center;gap:0.5rem;margin-left:auto;margin-right:1rem;">
        <span style="font-size:1rem;">☀️</span>
        <label class="theme-switch" style="position:relative;display:inline-block;width:44px;height:24px;margin:0;">
          <input type="checkbox" onchange="handleThemeToggle(this)" ${isDark ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute;">
          <span class="slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:rgba(255,255,255,0.3);transition:.4s;border-radius:24px;"></span>
          <span class="slider-btn" style="position:absolute;content:'';height:18px;width:18px;left:3px;bottom:3px;background-color:white;transition:transform .4s;border-radius:50%;"></span>
        </label>
        <span style="font-size:1rem;">🌙</span>
      </div>
      <style>
        .theme-switch input:checked ~ .slider { background-color: var(--accent); }
        .theme-switch input:checked ~ .slider-btn { transform: translateX(20px); }
      </style>
    `;
}

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
// Configuration for AWS deployment
const API_BASE_URL = 'https://8veb4h6aub.execute-api.ap-south-1.amazonaws.com';

async function api(method, url, body) {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(fullUrl, opts);
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

// ─── Auto Logout on Tab Close (>5s) ─────────────────────────────────
const lastUnload = localStorage.getItem('last_unload');
if (lastUnload) {
    const timeAway = Date.now() - parseInt(lastUnload, 10);
    // If >5 seconds passed since the last page unload, and they are on a secured page
    if (timeAway > 5000 && !window.location.pathname.includes('/login.html') && window.location.pathname !== '/') {
        logout();
    }
    localStorage.removeItem('last_unload');
}

window.addEventListener('beforeunload', () => {
    localStorage.setItem('last_unload', Date.now());
});

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

// ─── Sidebar Toggle (mobile & desktop) ─────────────────────────────
window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const mainContent = document.querySelector('.main-content');
    const isMobile = window.innerWidth <= 768;

    if (sidebar) {
        if (isMobile) {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('open');
        } else {
            sidebar.classList.toggle('closed');
            if (mainContent) mainContent.classList.toggle('expanded');
        }
    }
};

window.closeSidebar = function () {
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }
};

function initSidebar() {
    const toggle = document.querySelector('.menu-toggle');
    const overlay = document.querySelector('.sidebar-overlay');

    if (toggle) toggle.addEventListener('click', window.toggleSidebar);
    if (overlay) overlay.addEventListener('click', window.closeSidebar);
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
    const diff = new Date(dateStr) - new Date(); // Use actual current date
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
