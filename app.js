// Auth Guard Check
const userId = localStorage.getItem('uhs_user_id');
if (!userId && !window.location.pathname.includes('login.html')) {
  window.location.href = 'login.html';
}

// UI Elements
const sidenav = document.getElementById('sidenav');
const mobileToggle = document.getElementById('mobileToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const pageTitle = document.getElementById('pageTitle');
const logoutBtn = document.getElementById('logoutBtn');

// Sidebar Drawer Control
function toggleSidebar() {
  const isOpen = sidenav.classList.toggle('open');
  sidebarOverlay.classList.toggle('open', isOpen);
  toggleIcon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
}

if (mobileToggle) {
  mobileToggle.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', toggleSidebar);
}

// Navigation Route Selection
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    const label = item.querySelector('span').innerText;
    pageTitle.innerText = label;

    if (sidenav.classList.contains('open')) {
      toggleSidebar();
    }
  });
});

// Logout Handler
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('uhs_user_id');
    localStorage.removeItem('uhs_user_name');
    window.location.href = 'login.html';
  });
}

// Fetch Student Stats from Backend
async function fetchStudentSummary() {
  if (!userId) return;

  try {
    const res = await fetch(`/api/users/${userId}/nav-summary`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('userName').innerText = data.name || 'Urbana Student';

      if (data.pendingRequests > 0) {
        const friendBadge = document.getElementById('friendBadge');
        friendBadge.innerText = `${data.pendingRequests} new`;
        friendBadge.style.display = 'inline-block';
      }

      if (data.dueAssignments > 0) {
        const taskBadge = document.getElementById('taskBadge');
        taskBadge.innerText = data.dueAssignments;
        taskBadge.style.display = 'inline-block';
      }
    }
  } catch (err) {
    console.error("Could not fetch user summary:", err);
    document.getElementById('userName').innerText = localStorage.getItem('uhs_user_name') || 'Urbana Student';
  }
}

fetchStudentSummary();
