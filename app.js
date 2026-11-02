const userId = localStorage.getItem('uhs_user_id');
const userRole = localStorage.getItem('uhs_user_role');

if (!userId && !window.location.pathname.includes('login.html')) {
  window.location.href = 'login.html';
}

const sidenav = document.getElementById('sidenav');
const mobileToggle = document.getElementById('mobileToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const logoutBtn = document.getElementById('logoutBtn');
const adminNavItem = document.getElementById('adminNavItem');

if (userRole === 'admin' && adminNavItem) {
  adminNavItem.style.display = 'flex';
}

function toggleSidebar() {
  const isOpen = sidenav.classList.toggle('open');
  sidebarOverlay.classList.toggle('open', isOpen);
}

if (mobileToggle) {
  mobileToggle.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', toggleSidebar);
}

// Route Switcher
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    const path = item.getAttribute('data-path');
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

    const activeSec = document.getElementById(`view-${path}`);
    if (activeSec) activeSec.style.display = 'block';

    if (sidenav.classList.contains('open')) toggleSidebar();
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
}

// MAIN DATA LOADER
async function initApp() {
  if (!userId) return;

  // Fetch User Info
  const userRes = await fetch(`/api/users/${userId}`);
  if (userRes.ok) {
    const user = await userRes.json();
    document.getElementById('userName').innerText = user.name;
    document.getElementById('dashTotalClasses').innerText = (user.schedule || []).length;
    renderUserSchedule(user.schedule || []);
  }

  // Fetch Calendar Days Off
  const calRes = await fetch('/api/calendar');
  if (calRes.ok) {
    const events = await calRes.json();
    renderCalendarEvents(events);
    checkTodayStatus(events);
  }

  // Fetch Master Schedule Template
  const masterRes = await fetch('/api/master-schedule');
  if (masterRes.ok) {
    const master = await masterRes.json();
    renderMasterSchedule(master);
  }

  if (userRole === 'admin') loadAdminData();
}

function renderUserSchedule(schedule) {
  const tbody = document.getElementById('scheduleTableBody');
  if (schedule.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No classes added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = schedule.map((item, idx) => `
    <tr>
      <td><strong>${item.period}</strong></td>
      <td>${item.className}</td>
      <td>${item.room}</td>
      <td>${item.teacher}</td>
      <td><button onclick="deleteClass(${idx})" class="delete-btn">Delete</button></td>
    </tr>
  `).join('');
}

function checkTodayStatus(events) {
  const today = new Date().toISOString().split('T')[0];
  const dayOffToday = events.find(e => e.date === today);

  const statusEl = document.getElementById('dashTodayStatus');
  if (dayOffToday) {
    statusEl.innerText = `NO SCHOOL: ${dayOffToday.title}`;
    statusEl.style.color = '#ff5555';
  } else {
    statusEl.innerText = 'Regular Urbana High School Day';
    statusEl.style.color = '#55ff55';
  }
}

function renderCalendarEvents(events) {
  const container = document.getElementById('calendarList');
  if (events.length === 0) {
    container.innerHTML = '<p class="empty-msg">No upcoming days off listed.</p>';
    return;
  }
  container.innerHTML = events.map(e => `
    <div class="class-summary-item">
      <div><strong>${e.date}</strong> - ${e.title}</div>
      ${userRole === 'admin' ? `<button onclick="deleteCalendarDate('${e.date}')" class="delete-btn">Remove</button>` : ''}
    </div>
  `).join('');
}

function renderMasterSchedule(master) {
  const container = document.getElementById('dashMasterSchedule');
  if (master.length === 0) {
    container.innerHTML = '<p class="empty-msg">Master bell schedule has not been set by admin.</p>';
    return;
  }
  container.innerHTML = master.map(m => `
    <div class="class-summary-item">
      <div><strong>${m.period}:</strong> ${m.startTime} - ${m.endTime} (${m.label || 'Standard Class'})</div>
      ${userRole === 'admin' ? `<button onclick="deleteMasterSlot('${m._id}')" class="delete-btn">Delete Slot</button>` : ''}
    </div>
  `).join('');
}

// SCHEDULE FORM
document.getElementById('addClassForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newClass = {
    period: document.getElementById('classPeriod').value,
    className: document.getElementById('className').value,
    room: document.getElementById('classRoom').value,
    teacher: document.getElementById('classTeacher').value
  };
  await fetch(`/api/users/${userId}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newClass)
  });
  initApp();
});

async function deleteClass(index) {
  await fetch(`/api/users/${userId}/schedule/${index}`, { method: 'DELETE' });
  initApp();
}

// ADMIN FORM ACTIONS
const adminCalForm = document.getElementById('adminCalendarForm');
if (adminCalForm) {
  adminCalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/admin/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: document.getElementById('adminDate').value,
        title: document.getElementById('adminDateTitle').value
      })
    });
    initApp();
  });
}

const adminMasterForm = document.getElementById('adminMasterForm');
if (adminMasterForm) {
  adminMasterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/admin/master-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: document.getElementById('masterPeriod').value,
        startTime: document.getElementById('masterStart').value,
        endTime: document.getElementById('masterEnd').value,
        label: document.getElementById('masterLabel').value
      })
    });
    initApp();
  });
}

async function deleteCalendarDate(date) {
  await fetch(`/api/admin/calendar/${date}`, { method: 'DELETE' });
  initApp();
}

async function deleteMasterSlot(id) {
  await fetch(`/api/admin/master-schedule/${id}`, { method: 'DELETE' });
  initApp();
}

async function loadAdminData() {
  const res = await fetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    document.getElementById('adminUsersTableBody').innerHTML = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td><span class="badge">${u.role}</span></td>
        <td><button onclick="deleteUser('${u._id}')" class="delete-btn">Delete</button></td>
      </tr>
    `).join('');
  }
}

async function deleteUser(id) {
  if (confirm("Delete this user account?")) {
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    loadAdminData();
  }
}

initApp();
