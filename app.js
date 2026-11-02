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

let currentActiveChatId = null;
let cachedMasterSchedule = [];
let chatPollingInterval = null; // Live Chat Poller

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

// Navigation View Switcher
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    const path = item.getAttribute('data-path');
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

    const activeSec = document.getElementById(`view-${path}`);
    if (activeSec) activeSec.style.display = 'block';

    // Start live polling if switching to chat
    if (path === 'chat') {
      loadChatChannels();
      startLiveChatPolling();
    } else {
      stopLiveChatPolling();
    }

    if (sidenav.classList.contains('open')) toggleSidebar();
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    stopLiveChatPolling();
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
    
    // Set PFP Avatar
    const firstLetter = (user.name || 'U').charAt(0).toUpperCase();
    document.getElementById('navPfpDisplay').innerText = firstLetter;
    document.getElementById('pfpPreview').innerText = firstLetter;

    if (user.avatarBg) {
      applyAvatarStyling(user.avatarBg, user.avatarColor || '#000000');
    }
  }

  const [calRes, masterRes, bannerRes] = await Promise.all([
    fetch('/api/calendar'),
    fetch('/api/master-schedule'),
    fetch('/api/announcement')
  ]);

  const events = calRes.ok ? await calRes.json() : [];
  cachedMasterSchedule = masterRes.ok ? await masterRes.json() : [];
  
  if (bannerRes.ok) {
    const banner = await bannerRes.json();
    if (banner && banner.text) {
      document.getElementById('bannerText').innerText = banner.text;
      document.getElementById('emergencyBanner').style.display = 'flex';
    }
  }

  renderCalendarEvents(events);
  checkTodayStatus(events, cachedMasterSchedule);
  startPeriodCountdown();

  if (userRole === 'admin') loadAdminData();
}

// LIVE PERIOD COUNTDOWN TIMER
function startPeriodCountdown() {
  setInterval(updateCountdownDisplay, 1000);
  updateCountdownDisplay();
}

function updateCountdownDisplay() {
  const countdownEl = document.getElementById('periodCountdown');
  const subtextEl = document.getElementById('countdownSubtext');

  if (!cachedMasterSchedule || cachedMasterSchedule.length === 0) {
    countdownEl.innerText = "No Bell Schedule";
    subtextEl.innerText = "Ask admin to set master bell slots.";
    return;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const secondsLeft = 59 - now.getSeconds();

  let activePeriod = null;
  let nextPeriod = null;

  for (let i = 0; i < cachedMasterSchedule.length; i++) {
    const slot = cachedMasterSchedule[i];
    const startMins = timeToMinutes(slot.startTime);
    const endMins = timeToMinutes(slot.endTime);

    if (currentMinutes >= startMins && currentMinutes < endMins) {
      activePeriod = { ...slot, endMins };
      break;
    } else if (currentMinutes < startMins && !nextPeriod) {
      nextPeriod = { ...slot, startMins };
    }
  }

  if (activePeriod) {
    const minsLeft = activePeriod.endMins - currentMinutes - 1;
    countdownEl.innerText = `${minsLeft}m ${secondsLeft}s left`;
    subtextEl.innerText = `Currently in Period: ${activePeriod.period} (${activePeriod.label || 'Class'})`;
    countdownEl.style.color = '#55ff55';
  } else if (nextPeriod) {
    const minsUntil = nextPeriod.startMins - currentMinutes - 1;
    countdownEl.innerText = `Starts in ${minsUntil}m ${secondsLeft}s`;
    subtextEl.innerText = `Next up: Period ${nextPeriod.period} at ${nextPeriod.startTime}`;
    countdownEl.style.color = '#ffaa00';
  } else {
    countdownEl.innerText = "School Day Ended";
    subtextEl.innerText = "No upcoming classes remaining today.";
    countdownEl.style.color = '#888888';
  }
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// PROFILE PICTURE (PFP) CUSTOMIZATION
async function setAvatarTheme(bgColor, textColor) {
  applyAvatarStyling(bgColor, textColor);
  await fetch(`/api/users/${userId}/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarBg: bgColor, avatarColor: textColor })
  });
}

function applyAvatarStyling(bg, color) {
  const navPfp = document.getElementById('navPfpDisplay');
  const previewPfp = document.getElementById('pfpPreview');

  navPfp.style.background = bg;
  navPfp.style.color = color;
  previewPfp.style.background = bg;
  previewPfp.style.color = color;
}

// LIVE UPDATING STUDENT CHAT & GROUP SYSTEM
function startLiveChatPolling() {
  stopLiveChatPolling();
  // Poll for new messages every 2 seconds
  chatPollingInterval = setInterval(() => {
    if (currentActiveChatId) {
      loadMessages(true); // Silent update
    }
  }, 2000);
}

function stopLiveChatPolling() {
  if (chatPollingInterval) {
    clearInterval(chatPollingInterval);
    chatPollingInterval = null;
  }
}

async function loadChatChannels() {
  const container = document.getElementById('chatChannelsList');
  const res = await fetch(`/api/chat/channels/${userId}`);
  
  if (res.ok) {
    const channels = await res.json();
    if (channels.length === 0) {
      container.innerHTML = '<p class="empty-msg">No chats yet. Create a group!</p>';
      return;
    }
    container.innerHTML = channels.map(c => `
      <div onclick="selectChatChannel('${c._id}', '${c.name}')" class="class-summary-item" style="cursor: pointer; padding: 0.6rem; ${currentActiveChatId === c._id ? 'border-color: #ffffff;' : ''}">
        <div>
          <strong style="font-size: 0.9rem;">${c.name}</strong>
          <div style="font-size: 0.75rem; color: #888;">${c.isGroup ? 'Group Chat' : 'Direct Message'}</div>
        </div>
      </div>
    `).join('');
  }
}

async function selectChatChannel(channelId, channelName) {
  currentActiveChatId = channelId;
  document.getElementById('activeChatHeader').innerHTML = `
    <span>${channelName}</span>
    <span id="liveStatusBadge" style="font-size: 0.75rem; color: #55ff55;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; vertical-align: middle;"></i> Live Sync</span>
  `;
  loadMessages(false);
  loadChatChannels();
}

async function loadMessages(isSilent = false) {
  if (!currentActiveChatId) return;
  const historyEl = document.getElementById('messageHistory');
  const res = await fetch(`/api/chat/messages/${currentActiveChatId}`);
  
  if (res.ok) {
    const messages = await res.json();
    
    // Check if scrolled near bottom before rendering
    const isAtBottom = historyEl.scrollHeight - historyEl.clientHeight <= historyEl.scrollTop + 50;

    if (messages.length === 0) {
      historyEl.innerHTML = '<p class="empty-msg">No messages here yet. Say hi!</p>';
      return;
    }

    historyEl.innerHTML = messages.map(m => `
      <div style="align-self: ${m.senderId === userId ? 'flex-end' : 'flex-start'}; max-width: 70%; background: ${m.senderId === userId ? '#ffffff' : '#1a1a1a'}; color: ${m.senderId === userId ? '#000000' : '#ffffff'}; padding: 0.5rem 0.75rem; border-radius: 8px;">
        <div style="font-size: 0.7rem; color: ${m.senderId === userId ? '#555' : '#aaa'}; font-weight: bold;">${m.senderName}</div>
        <div>${m.text}</div>
      </div>
    `).join('');

    if (!isSilent || isAtBottom) {
      historyEl.scrollTop = historyEl.scrollHeight;
    }
  }
}

document.getElementById('sendMessageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentActiveChatId) return alert('Please select a chat channel first.');

  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: currentActiveChatId,
      senderId: userId,
      senderName: document.getElementById('userName').innerText,
      text
    })
  });

  input.value = '';
  loadMessages(false);
});

// Group Modal Trigger
document.getElementById('openGroupModalBtn').addEventListener('click', async () => {
  const modal = document.getElementById('groupModal');
  const userCheckboxes = document.getElementById('groupUserCheckboxes');
  
  const res = await fetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    userCheckboxes.innerHTML = users.filter(u => u._id !== userId).map(u => `
      <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" value="${u._id}" class="group-member-checkbox">
        ${u.name} (@${u.username})
      </label>
    `).join('');
  }
  modal.style.display = 'flex';
});

function closeGroupModal() {
  document.getElementById('groupModal').style.display = 'none';
}

document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const groupName = document.getElementById('groupNameInput').value;
  const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
  const memberIds = Array.from(checkboxes).map(cb => cb.value);
  memberIds.push(userId);

  await fetch('/api/chat/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: groupName,
      isGroup: true,
      members: memberIds
    })
  });

  closeGroupModal();
  loadChatChannels();
});

// DASHBOARD HELPERS
function checkTodayStatus(events, masterSchedule) {
  const today = new Date().toISOString().split('T')[0];
  const dayEvent = events.find(e => e.date === today);
  const statusEl = document.getElementById('dashTodayStatus');

  if (dayEvent && dayEvent.isDayOff) {
    statusEl.innerText = `NO SCHOOL: ${dayEvent.title}`;
    statusEl.style.color = '#ff5555';
    document.getElementById('dashMasterSchedule').innerHTML = `<div class="content-block"><p class="empty-msg">No classes scheduled today due to <strong>${dayEvent.title}</strong>.</p></div>`;
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

// ADMIN ANNOUNCEMENT CONTROL
const adminBannerForm = document.getElementById('adminBannerForm');
if (adminBannerForm) {
  adminBannerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('adminBannerText').value;
    await fetch('/api/admin/announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    initApp();
  });
}

async function clearAdminBanner() {
  await fetch('/api/admin/announcement', { method: 'DELETE' });
  document.getElementById('emergencyBanner').style.display = 'none';
}

// ADMIN FORM HANDLERS
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
