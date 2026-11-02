// Auth Guard Check
const userId = localStorage.getItem('uhs_user_id');
const userRole = localStorage.getItem('uhs_user_role');

if (!userId && !window.location.pathname.includes('login.html')) {
  window.location.href = 'login.html';
}

// Elements
const sidenav = document.getElementById('sidenav');
const mobileToggle = document.getElementById('mobileToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const logoutBtn = document.getElementById('logoutBtn');
const adminNavItem = document.getElementById('adminNavItem');

// Show Admin Tab if user is admin
if (userRole === 'admin' && adminNavItem) {
  adminNavItem.style.display = 'flex';
}

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

// Navigation View Switcher
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    const path = item.getAttribute('data-path');

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

    // Show active view section
    const activeSection = document.getElementById(`view-${path}`);
    if (activeSection) activeSection.style.display = 'block';

    if (sidenav.classList.contains('open')) toggleSidebar();
  });
});

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
}

// FETCH & RENDER SCHEDULE DATA
async function loadUserData() {
  if (!userId) return;

  try {
    const res = await fetch(`/api/users/${userId}`);
    if (res.ok) {
      const user = await res.json();

      document.getElementById('userName').innerText = user.name || 'Urbana Student';

      // 1. Render Dashboard Info
      renderDashboard(user.schedule || []);

      // 2. Render Schedule Table
      renderScheduleTable(user.schedule || []);

      // 3. Render Admin Panel if Admin
      if (userRole === 'admin') {
        loadAdminUserList();
      }
    }
  } catch (err) {
    console.error("Error loading user data:", err);
  }
}

// Render Dashboard
function renderDashboard(schedule) {
  document.getElementById('dashTotalClasses').innerText = schedule.length;
  const dashList = document.getElementById('dashClassList');

  if (schedule.length === 0) {
    dashList.innerHTML = '<p class="empty-msg">No classes added to your schedule yet.</p>';
    return;
  }

  dashList.innerHTML = schedule.map(item => `
    <div class="class-summary-item">
      <div>
        <strong>${item.period}: ${item.className}</strong>
        <div style="font-size: 0.8rem; color: #888888;">Room ${item.room} • ${item.teacher}</div>
      </div>
    </div>
  `).join('');
}

// Render Schedule Table
function renderScheduleTable(schedule) {
  const tbody = document.getElementById('scheduleTableBody');

  if (schedule.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No classes added yet. Use the form above to add one.</td></tr>';
    return;
  }

  tbody.innerHTML = schedule.map((item, index) => `
    <tr>
      <td><strong>${item.period}</strong></td>
      <td>${item.className}</td>
      <td>${item.room}</td>
      <td>${item.teacher}</td>
      <td><button onclick="deleteClass(${index})" class="delete-btn"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

// Add Class Handler
const addClassForm = document.getElementById('addClassForm');
if (addClassForm) {
  addClassForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newClass = {
      period: document.getElementById('classPeriod').value,
      className: document.getElementById('className').value,
      room: document.getElementById('classRoom').value,
      teacher: document.getElementById('classTeacher').value
    };

    try {
      const res = await fetch(`/api/users/${userId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClass)
      });

      if (res.ok) {
        addClassForm.reset();
        loadUserData();
      }
    } catch (err) {
      alert("Failed to add class.");
    }
  });
}

// Delete Class Handler
async function deleteClass(index) {
  try {
    const res = await fetch(`/api/users/${userId}/schedule/${index}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      loadUserData();
    }
  } catch (err) {
    alert("Failed to delete class.");
  }
}

// Load Admin User List
async function loadAdminUserList() {
  try {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const users = await res.json();
      const tbody = document.getElementById('adminUsersTableBody');

      tbody.innerHTML = users.map(u => `
        <tr>
          <td>${u.username}</td>
          <td>${u.name}</td>
          <td><span class="badge">${u.role || 'student'}</span></td>
          <td><button onclick="deleteUser('${u._id}')" class="delete-btn">Delete</button></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error("Failed to load admin user list.");
  }
}

// Delete User from Admin
async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) loadAdminUserList();
  } catch (err) {
    alert("Failed to delete user.");
  }
}

loadUserData();
