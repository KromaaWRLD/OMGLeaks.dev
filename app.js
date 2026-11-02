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
let currentActiveChannelObj = null;
let cachedMasterSchedule = [];
let chatPollingInterval = null;
let typingTimeout = null;
let attachedBase64Image = null;
let isMaintenanceActive = false;

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

async function authFetch(url, options = {}) {
  options.headers = {
    ...options.headers,
    'x-user-id': userId
  };
  const res = await fetch(url, options);
  if (res.status === 503 && userRole !== 'admin') {
    const data = await res.json();
    alert(data.error || 'System is currently down for maintenance.');
  }
  return res;
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

// INITIALIZATION
async function initApp() {
  if (!userId) return;

  const userRes = await authFetch(`/api/users/${userId}`);
  if (userRes.ok) {
    const user = await userRes.json();
    document.getElementById('userName').innerText = user.name;
    
    const firstLetter = (user.name || 'U').charAt(0).toUpperCase();
    document.getElementById('navPfpDisplay').innerText = firstLetter;
    document.getElementById('pfpPreview').innerText = firstLetter;

    if (user.avatarBg) {
      applyAvatarStyling(user.avatarBg, user.avatarColor || '#000000');
    }
  }

  const [calRes, masterRes] = await Promise.all([
    authFetch('/api/calendar'),
    authFetch('/api/master-schedule')
  ]);

  const events = calRes.ok ? await calRes.json() : [];
  cachedMasterSchedule = masterRes.ok ? await masterRes.json() : [];

  renderCalendarEvents(events);
  checkTodayStatus(events, cachedMasterSchedule);
  startPeriodCountdown();

  loadUnreadBadgeCount();
  setInterval(loadUnreadBadgeCount, 3000);

  if (userRole === 'admin') loadAdminData();
}

// WORKING REAL-TIME UNREAD NOTIFICATIONS
async function loadUnreadBadgeCount() {
  const res = await authFetch(`/api/chat/channels/${userId}`);
  if (res.ok) {
    const channels = await res.json();
    const totalUnread = channels.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const badge = document.getElementById('totalUnreadBadge');
    
    if (totalUnread > 0) {
      badge.innerText = totalUnread;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    // Refresh current channel list in background to update individual badges
    if (document.getElementById('view-chat').style.display !== 'none') {
      renderChatChannelsList(channels);
    }
  }
}

// LIVE PERIOD COUNTDOWN
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

// AVATAR SETTINGS
async function setAvatarTheme(bgColor, textColor) {
  applyAvatarStyling(bgColor, textColor);
  await authFetch(`/api/users/${userId}/avatar`, {
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

// ACCOUNT DELETION
document.getElementById('deleteAccountForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('deleteAccountPass').value;
  if (!confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) return;

  const res = await authFetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (res.ok) {
    alert("Account deleted.");
    localStorage.clear();
    window.location.href = 'login.html';
  } else {
    const data = await res.json();
    alert(data.error || "Failed to delete account.");
  }
});

// LIVE CHAT & CHANNELS
function startLiveChatPolling() {
  stopLiveChatPolling();
  chatPollingInterval = setInterval(() => {
    if (currentActiveChatId) {
      loadMessages(true);
      fetchTypingStatus();
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
  const res = await authFetch(`/api/chat/channels/${userId}`);
  if (res.ok) {
    const channels = await res.json();
    renderChatChannelsList(channels);
  }
}

function renderChatChannelsList(channels) {
  const container = document.getElementById('chatChannelsList');
  if (channels.length === 0) {
    container.innerHTML = '<p class="empty-msg">No chats yet. Create a group!</p>';
    return;
  }

  container.innerHTML = channels.map(c => {
    const isSelected = currentActiveChatId === c._id;
    const isAdmin = c.adminId === userId;

    return `
      <div onclick="selectChatChannel('${c._id}')" class="class-summary-item" style="cursor: pointer; padding: 0.6rem; ${isSelected ? 'border-color: #ffffff;' : ''}">
        <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="font-size: 0.9rem;">${c.name}</strong>
            <div style="font-size: 0.75rem; color: #888;">
              ${c.isGroup ? 'Group Chat' : 'Direct Message'}
              ${isAdmin ? ' • <span style="color: #ffaa00;">Admin</span>' : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${c.unreadCount > 0 ? `<span class="badge" style="background: #ff3333; color: #fff;">${c.unreadCount}</span>` : ''}
            ${(c.isGroup && isAdmin) ? `<i onclick="deleteGroupChannel(event, '${c._id}')" class="fa-solid fa-trash" style="color: #ff5555; cursor: pointer; font-size: 0.85rem;" title="Delete Group"></i>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// GROUP DELETION
async function deleteGroupChannel(event, channelId) {
  event.stopPropagation();
  if (!confirm("Are you sure you want to delete this group chat for all members?")) return;

  const res = await authFetch(`/api/chat/channels/${channelId}`, { method: 'DELETE' });
  if (res.ok) {
    if (currentActiveChatId === channelId) {
      currentActiveChatId = null;
      document.getElementById('activeChatHeader').innerHTML = '<span>Select a conversation to start chatting</span>';
      document.getElementById('messageHistory').innerHTML = '<p class="empty-msg">No conversation selected.</p>';
    }
    loadChatChannels();
    loadUnreadBadgeCount();
  } else {
    alert("Failed to delete group.");
  }
}

async function selectChatChannel(channelId) {
  currentActiveChatId = channelId;
  const res = await authFetch(`/api/chat/channels/${userId}`);
  if (res.ok) {
    const channels = await res.json();
    currentActiveChannelObj = channels.find(c => c._id === channelId);
    
    // Header without Live Sync text
    document.getElementById('activeChatHeader').innerHTML = `
      <span>${currentActiveChannelObj ? currentActiveChannelObj.name : 'Chat'}</span>
    `;
  }

  loadMessages(false);
  loadChatChannels();
  loadUnreadBadgeCount();
}

// TYPING INDICATORS
document.getElementById('chatInput').addEventListener('input', () => {
  if (!currentActiveChatId) return;

  sendTypingSignal(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => sendTypingSignal(false), 2000);
});

async function sendTypingSignal(isTyping) {
  await authFetch('/api/chat/typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: currentActiveChatId,
      userId,
      userName: document.getElementById('userName').innerText,
      isTyping
    })
  });
}

async function fetchTypingStatus() {
  if (!currentActiveChatId) return;
  const res = await authFetch(`/api/chat/typing/${currentActiveChatId}`);
  if (res.ok) {
    const data = await res.json();
    const banner = document.getElementById('typingBanner');
    if (data.typers && data.typers.length > 0) {
      banner.innerText = `${data.typers.join(', ')} ${data.typers.length > 1 ? 'are' : 'is'} typing...`;
    } else {
      banner.innerText = '';
    }
  }
}

// MESSAGES LOG & EDIT/DELETE
async function loadMessages(isSilent = false) {
  if (!currentActiveChatId) return;
  const historyEl = document.getElementById('messageHistory');
  const res = await authFetch(`/api/chat/messages/${currentActiveChatId}`);
  
  if (res.ok) {
    const messages = await res.json();
    const isAtBottom = historyEl.scrollHeight - historyEl.clientHeight <= historyEl.scrollTop + 50;

    if (messages.length === 0) {
      historyEl.innerHTML = '<p class="empty-msg">No messages here yet. Say hi!</p>';
      return;
    }

    historyEl.innerHTML = messages.map(m => {
      const isMine = m.senderId === userId;
      const isGroupAdmin = currentActiveChannelObj && currentActiveChannelObj.adminId === userId;
      const canDelete = isMine || isGroupAdmin;

      return `
        <div style="align-self: ${isMine ? 'flex-end' : 'flex-start'}; max-width: 75%; background: ${isMine ? '#ffffff' : '#1a1a1a'}; color: ${isMine ? '#000000' : '#ffffff'}; padding: 0.6rem 0.8rem; border-radius: 8px; position: relative;" class="chat-bubble">
          <div style="font-size: 0.7rem; color: ${isMine ? '#555' : '#aaa'}; font-weight: bold; display: flex; justify-content: space-between; gap: 1rem;">
            <span>${m.senderName} ${m.edited ? '(edited)' : ''}</span>
            <div>
              ${isMine ? `<i onclick="editMessagePrompt('${m._id}', '${m.text}')" class="fa-solid fa-pen" style="cursor: pointer; margin-right: 0.4rem;" title="Edit"></i>` : ''}
              ${canDelete ? `<i onclick="deleteMessage('${m._id}')" class="fa-solid fa-trash" style="cursor: pointer; color: #ff5555;" title="Delete"></i>` : ''}
            </div>
          </div>

          ${m.text ? `<div style="margin-top: 0.25rem;">${m.text}</div>` : ''}
          ${m.imageUrl ? `<img src="${m.imageUrl}" style="max-width: 100%; max-height: 200px; border-radius: 6px; margin-top: 0.5rem; display: block;">` : ''}
        </div>
      `;
    }).join('');

    if (!isSilent || isAtBottom) {
      historyEl.scrollTop = historyEl.scrollHeight;
    }
  }
}

// IMAGE ATTACHMENT
document.getElementById('chatImageInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    attachedBase64Image = evt.target.result;
    document.getElementById('imagePreviewThumb').src = attachedBase64Image;
    document.getElementById('imagePreviewContainer').style.display = 'flex';
  };
  reader.readAsDataURL(file);
});

function cancelImageAttachment() {
  attachedBase64Image = null;
  document.getElementById('chatImageInput').value = '';
  document.getElementById('imagePreviewContainer').style.display = 'none';
}

document.getElementById('sendMessageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentActiveChatId) return alert('Please select a chat channel first.');

  const input = document.getElementById('chatInput');
  const text = input.value.trim();

  if (!text && !attachedBase64Image) return;

  await authFetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: currentActiveChatId,
      senderId: userId,
      senderName: document.getElementById('userName').innerText,
      text,
      imageUrl: attachedBase64Image
    })
  });

  input.value = '';
  cancelImageAttachment();
  sendTypingSignal(false);
  loadMessages(false);
  loadUnreadBadgeCount();
});

async function editMessagePrompt(msgId, currentText) {
  const newText = prompt("Edit your message:", currentText);
  if (newText === null || newText.trim() === "") return;

  await authFetch(`/api/chat/messages/${msgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: newText.trim(), senderId: userId })
  });

  loadMessages(false);
}

async function deleteMessage(msgId) {
  if (!confirm("Delete this message?")) return;
  await authFetch(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
  loadMessages(false);
}

// GROUP CHAT CREATION
document.getElementById('openGroupModalBtn').addEventListener('click', async () => {
  const modal = document.getElementById('groupModal');
  const userCheckboxes = document.getElementById('groupUserCheckboxes');
  
  const res = await authFetch('/api/admin/users');
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

  await authFetch('/api/chat/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: groupName,
      isGroup: true,
      members: memberIds,
      adminId: userId
    })
  });

  closeGroupModal();
  loadChatChannels();
});

// MAINTENANCE MODE CONTROL
async function checkMaintenanceStatus() {
  const res = await authFetch('/api/config/maintenance');
  if (res.ok) {
    const data = await res.json();
    isMaintenanceActive = data.maintenance;
    const btn = document.getElementById('toggleMaintenanceBtn');
    if (btn) {
      btn.innerText = isMaintenanceActive ? 'Turn OFF Maintenance' : 'Turn ON Maintenance';
      btn.style.background = isMaintenanceActive ? '#ff5555' : '#ffffff';
      btn.style.color = isMaintenanceActive ? '#ffffff' : '#000000';
    }
  }
}

async function toggleMaintenanceMode() {
  const res = await authFetch('/api/admin/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maintenance: !isMaintenanceActive })
  });

  if (res.ok) {
    checkMaintenanceStatus();
  }
}

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

// ADMIN FORM HANDLERS
const adminCalForm = document.getElementById('adminCalendarForm');
if (adminCalForm) {
  adminCalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await authFetch('/api/admin/calendar', {
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
    await authFetch('/api/admin/master-schedule', {
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
  await authFetch(`/api/admin/calendar/${date}`, { method: 'DELETE' });
  initApp();
}

async function deleteMasterSlot(id) {
  await authFetch(`/api/admin/master-schedule/${id}`, { method: 'DELETE' });
  initApp();
}

async function loadAdminData() {
  checkMaintenanceStatus();
  const res = await authFetch('/api/admin/users');
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
    await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    loadAdminData();
  }
}

initApp();
