// Student sidebar builder and shared init
function buildStudentSidebar(activePage) {
  const navItems = [
    { href: '/student/dashboard.html', icon: '🏠', label: 'Dashboard', key: 'dashboard' },
    { href: '/student/marks.html', icon: '📊', label: 'Marks & Grades', key: 'marks' },
    { href: '/student/attendance.html', icon: '✅', label: 'Attendance', key: 'attendance' },
    { href: '/student/timetable.html', icon: '📅', label: 'Timetable', key: 'timetable' },
    { href: '/student/exams.html', icon: '📝', label: 'Exam Schedule', key: 'exams' },
    { href: '/student/calendar.html', icon: '📆', label: 'School Calendar', key: 'calendar' },
    { href: '/student/faculty.html', icon: '👨‍🏫', label: 'Faculty Directory', key: 'faculty' },
    { href: '/student/profile.html', icon: '👤', label: 'My Profile', key: 'profile' },
  ];

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="school-logo">
          <div class="logo-icon">🎓</div>
          <div class="logo-text">
            <div class="name">Adarsha High School</div>
            <div class="tagline">Student Portal</div>
          </div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-avatar" id="sidebar-avatar">?</div>
        <div class="user-info">
          <div class="user-name" id="sidebar-name">Loading...</div>
          <div class="user-role">Student</div>
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

function buildStudentTopBar(title) {
  const today = new Date('2026-02-28');
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `
    <div class="top-bar">
      <div style="display:flex;align-items:center;gap:1rem">
        <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
        <div class="top-bar-title">${title}</div>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;">
        ${getThemeToggleHTML()}
        <div class="top-bar-date">${dateStr}</div>
      </div>
    </div>
  `;
}

document.getElementById('sidebar-overlay')?.addEventListener('click', window.closeSidebar);

async function initStudentPage() {
  const session = await requireAuth('student');
  if (!session) return;
  try {
    const profile = await api('GET', '/api/student/profile');
    const avatar = document.getElementById('sidebar-avatar');
    const name = document.getElementById('sidebar-name');
    if (avatar) {
      if (profile.photo_url) {
        avatar.innerHTML = `<img src="${profile.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      } else {
        avatar.textContent = (profile.name || 'S')[0];
      }
    }
    if (name) name.textContent = profile.name;
    return profile;
  } catch (e) { console.error(e); }
}
