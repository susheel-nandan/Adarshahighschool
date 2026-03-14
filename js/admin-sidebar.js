// Admin sidebar builder and shared init
function buildAdminSidebar(activePage) {
  const navItems = [
    { href: '/admin/dashboard.html', icon: '🏠', label: 'Dashboard', key: 'dashboard' },
    { href: '/admin/students.html', icon: '🎒', label: 'Students', key: 'students' },
    { href: '/admin/parents.html', icon: '👨‍👩‍👧', label: 'Parents', key: 'parents' },
    { href: '/admin/timetable.html', icon: '📅', label: 'Timetable', key: 'timetable' },
    { href: '/admin/marks.html', icon: '📊', label: 'Marks', key: 'marks' },
    { href: '/admin/exams.html', icon: '📝', label: 'Exam Schedule', key: 'exams' },
    { href: '/admin/attendance.html', icon: '✅', label: 'Attendance', key: 'attendance' },
    { href: '/admin/faculty.html', icon: '👩‍🏫', label: 'Faculty', key: 'faculty' },
    { href: '/admin/class-faculty.html', icon: '🔗', label: 'Class-Faculty', key: 'class-faculty' },
    { href: '/admin/calendar-admin.html', icon: '📆', label: 'Calendar Events', key: 'calendar-admin' },
    { href: '/admin/complaints.html', icon: '📢', label: 'Complaints', key: 'complaints' },
    { href: '/admin/profile.html', icon: '👤', label: 'My Profile', key: 'profile' },
  ];
  return `
    <aside class="sidebar" id="sidebar" style="--sidebar-accent:var(--danger)">
      <div class="sidebar-header">
        <div class="school-logo">
          <div class="logo-icon">🔧</div>
          <div class="logo-text">
            <div class="name">Adarsha High School</div>
            <div class="tagline">Admin Panel</div>
          </div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-avatar" style="background:linear-gradient(135deg,var(--danger),#b91c1c)">A</div>
        <div class="user-info">
          <div class="user-name" id="sidebar-name">Administrator</div>
          <div class="user-role" style="color:#f87171">School Admin</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Admin Panel</div>
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

function buildAdminTopBar(title) {
  return `
    <div class="top-bar">
      <div style="display:flex;align-items:center;gap:1rem">
        <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
        <div class="top-bar-title">${title}</div>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;">
        ${getThemeToggleHTML()}
        <span class="badge badge-danger" style="font-size:.72rem">Admin Session</span>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sidebar-overlay')?.addEventListener('click', window.closeSidebar);
});

async function initAdminPage() {
  const session = await requireAuth('admin');
  if (!session) return null;
  return session;
}
