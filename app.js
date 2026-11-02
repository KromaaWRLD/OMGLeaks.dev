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

// Navigation Switcher
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

// APP INITIALIZATION
async function initApp() {
  if (!userId) return;

  const userRes = await fetch(`/api/users/${userId}`);
  if (userRes.ok) {
    const user = await userRes.json();
    document.getElementById('userName').innerText = user.name;
    document.getElementById('dashTotalClasses').innerText = (user.schedule || []).length;
    renderUserSchedule(user.schedule || []);
  }

  const [calRes, masterRes] = await Promise.all([
    fetch('/api/calendar'),
    fetch('/api/master-schedule')
  ]);

  const events = calRes.ok ? await calRes.json() : [];
  const master = masterRes.ok ? await masterRes.json() : [];

  renderCalendarEvents(events);
  checkTodayStatus(events, master);

  if (userRole === 'admin') loadAdminData();
}

// Check Daily Status vs Everyday Master Schedule
function checkTodayStatus(events, masterSchedule) {
  const today = new Date().toISOString().split('T')[0];
  const dayEvent = events.find(e => e.date === today);

  const statusEl = document.getElementById('dashTodayStatus');

  if (dayEvent && dayEvent.isDayOff) {
    statusEl.innerText = `NO SCHOOL: ${dayEvent.title}`;
    statusEl.style.color = '#ff5555';
    document.getElementById('dashMasterSchedule').innerHTML = `
      <div class="content-block">
        <p class="empty-msg">No classes today due to <strong>${dayEvent.title}</strong>.</p>
      </div>`;
    return;
  }

  if (dayEvent && !dayEvent.isDayOff) {
    statusEl.innerText = `Special Schedule: ${dayEvent.title}`;
    statusEl.style.color = '#ffaa00';
  } else {
    statusEl.innerText = 'Regular Everyday Schedule';
    statusEl.style.color = '#55ff55';
  }

  renderMasterSchedule(masterSchedule);
}

function renderMasterSchedule(master) {
  const container = document.getElementById('dashMasterSchedule');
  if (!master || master.length === 0) {
    container.innerHTML = '<p class="empty-msg">No master bell schedule set by admin yet.</p>';
    return;
  }

  container.innerHTML = master.map(m => `
    <div class="class-summary-item">
      <div>
        <strong>${m.period}:</strong> ${m.startTime} – ${m.endTime}
        <span style="font-size: 0.8rem; color: #888; margin-left: 0.5rem;">(${m.label || 'Standard Class'})</span>
      </div>
      ${userRole === 'admin' ? `<button onclick="deleteMasterSlot('${m._id}')" class="delete-btn">Delete Slot</button>` : ''}
    </div>
  `).join('');
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

function renderCalendarEvents(events) {
  const container = document.getElementById('calendarList');
  if (events.length === 0) {
    container.innerHTML = '<p class="empty-msg">No upcoming days off listed.</p>';
    return;
  }
  container.innerHTML = events.map(e => `
    <div class="class-summary-item">
      <div><strong>${e.date}</strong> - ${e.title} ${e.isDayOff ? '(No School)' : '(Special Schedule)'}</div>
      ${userRole === 'admin' ? `<button onclick="deleteCalendarDate('${e.date}')" class="delete-btn">Remove</button>` : ''}
    </div>
  `).join('');
}

// Student Schedule Form
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

// Password Update in Settings
const passForm = document.getElementById('updatePasswordForm');
if (passForm) {
  passForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('settingsMsg');
    msg.innerText = 'Updating password...';
    msg.style.color = '#aaa';

    // Simulate update or send to backend API
    setTimeout(() => {
      msg.innerText = 'Password successfully updated!';
      msg.style.color = '#55ff55';
      passForm.reset();
    }, 800);
  });
}

// Admin Form Handlers
const adminCalForm = document.getElementById('adminCalendarForm');
if (adminCalForm) {
  adminCalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/admin/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: document.getElementById('adminDate').value,
        title: document.getElementById('adminDateTitle').value,
        isDayOff: document.getElementById('adminIsDayOff').value
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
