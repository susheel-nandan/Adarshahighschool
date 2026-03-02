// Parent sidebar builder and shared init
function buildParentSidebar(activePage) {
  const navItems = [
    { href: '/parent/dashboard.html', icon: '🏠', label: 'Dashboard', key: 'dashboard' },
    { href: '/parent/marks.html', icon: '📊', label: "Child's Marks", key: 'marks' },
    { href: '/parent/attendance.html', icon: '✅', label: "Attendance", key: 'attendance' },
    { href: '/parent/timetable.html', icon: '📅', label: 'Timetable', key: 'timetable' },
    { href: '/parent/calendar.html', icon: '📆', label: 'School Calendar', key: 'calendar' },
    { href: '/parent/faculty.html', icon: '👩‍🏫', label: 'Faculty Directory', key: 'faculty' },
    { href: '/parent/profile.html', icon: '👤', label: 'My Profile', key: 'profile' },
  ];
  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="school-logo">
          <div class="logo-icon">🎓</div>
          <div class="logo-text">
            <div class="name">Adarsha High School</div>
            <div class="tagline">Parent Portal</div>
          </div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-avatar" id="sidebar-avatar">?</div>
        <div class="user-info">
          <div class="user-name" id="sidebar-name">Loading...</div>
          <div class="user-role" style="color:var(--accent-light)">Parent / Guardian</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Navigation</div>
        ${navItems.map(n => `
          <a href="${n.href}" class="nav-item${n.key === activePage ? ' active' : ''}">
            <span class="nav-icon">${n.icon}</span>
            <span>${n.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="btn-logout" onclick="logout()">🚪 Sign Out</button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
}

function buildParentTopBar(title) {
  const today = new Date('2026-02-28');
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `
    <div class="top-bar">
      <div style="display:flex;align-items:center;gap:1rem">
        <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
        <div class="top-bar-title">${title}</div>
      </div>
      <div class="top-bar-date">${dateStr}</div>
    </div>
  `;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
});

async function initParentPage() {
  const session = await requireAuth('parent');
  if (!session) return null;
  try {
    const data = await api('GET', '/api/parent/profile');
    const avatar = document.getElementById('sidebar-avatar');
    const name = document.getElementById('sidebar-name');
    if (avatar) avatar.textContent = (data.parent.name || 'P')[0];
    if (name) name.textContent = data.parent.name;
    return data;
  } catch (e) { console.error(e); return null; }
}
