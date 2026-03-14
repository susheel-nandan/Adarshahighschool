function buildTeacherSidebar(activePage) {
  const navItems = [
    { href: '/teacher/dashboard.html', icon: '🏠', label: 'Dashboard', key: 'dashboard' },
    { href: '/teacher/profile.html', icon: '👤', label: 'My Profile', key: 'profile' },
  ];

  return `
    <aside class="sidebar" id="sidebar" style="--sidebar-accent:var(--teal)">
      <div class="sidebar-header">
        <div class="school-logo">
          <div class="logo-icon">🎓</div>
          <div class="logo-text">
            <div class="name">Adarsha Portal</div>
            <div class="tagline">Teacher Portal</div>
          </div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-avatar" id="teacher-avatar" style="background:linear-gradient(135deg,var(--teal),var(--primary))">T</div>
        <div class="user-info">
          <div class="user-name" id="teacher-name">Loading...</div>
          <div class="user-role" style="color:var(--teal-light)">Teacher</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(item => `
          <a href="${item.href}" class="nav-item${activePage === item.key ? ' active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="btn-logout" onclick="logout()">🚪 Sign Out</button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>`;
}

function buildTeacherTopBar(title) {
  return `
    <div class="top-bar">
      <div style="display:flex;align-items:center;gap:.75rem">
        <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
        <div class="top-bar-title">${title}</div>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;">
        ${getThemeToggleHTML()}
        <div class="top-bar-date" id="topbar-date"></div>
      </div>
    </div>`;
}

async function initTeacherPage() {
  const session = await api('GET', '/api/auth/session');
  if (!session.loggedIn || session.role !== 'teacher') {
    window.location.href = '/login.html'; return;
  }
  const profile = await api('GET', '/api/teacher/profile').catch(() => null);
  if (profile) {
    document.getElementById('teacher-name').textContent = profile.name || 'Teacher';
    const av = document.getElementById('teacher-avatar');
    if (av) av.textContent = (profile.name || 'T')[0].toUpperCase();
  }
  const d = new Date();
  const el = document.getElementById('topbar-date');
  if (el) el.textContent = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  return profile;
}
