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

// Custom Fetch Wrapper to attach User ID Header & handle maintenance
async function authFetch(url, options = {}) {
  options.headers = {
    ...options.headers,
    'x-user-id': userId
  };

  try {
    const res = await fetch(url, options);

    if (res.status === 503 && userRole !== 'admin') {
      const data = await res.json();
      const overlay = document.getElementById('maintenanceOverlay');
      if (overlay) {
        document.getElementById('maintMessage').innerText = data.message || 'Under Maintenance';
        document.getElementById('maintTime').innerText = data.estimatedTime || 'Soon';
        overlay.style.display = 'flex';
      }
    }

    return res;
  } catch (err) {
    console.error('Connection error while fetching:', url, err);
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Unable to connect to server. Check network connection.' })
    };
  }
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

    if (path === 'chat') {
      loadChatChannels();
      loadDMStudentList();
      startLiveChatPolling();
    } else {
      stopLiveChatPolling();
    }

    if (path === 'resources') loadResourcesList();
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

// UNREAD BADGE COUNT
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

    if (document.getElementById('view-chat').style.display !== 'none') {
      renderChatChannelsList(channels);
    }
  }
}

// PERIOD COUNTDOWN TIMER
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

// DIRECT MESSAGING & CHAT CHANNELS
async function loadDMStudentList() {
  const container = document.getElementById('dmStudentList');
  const res = await authFetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    container.innerHTML = users.filter(u => u._id !== userId).map(u => `
      <div onclick="openDirectMessage('${u._id}')" style="cursor: pointer; padding: 0.3rem 0.5rem; background: #111; border-radius: 4px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
        <span>${u.name}</span>
        <i class="fa-solid fa-paper-plane" style="font-size: 0.7rem; color: #888;"></i>
      </div>
    `).join('');
  }
}

async function openDirectMessage(targetUserId) {
  const res = await authFetch('/api/chat/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId })
  });

  if (res.ok) {
    const channel = await res.json();
    loadChatChannels();
    selectChatChannel(channel._id);
  }
}

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
    container.innerHTML = '<p class="empty-msg">No chats yet. Pick a student below to DM!</p>';
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
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function selectChatChannel(channelId) {
  currentActiveChatId = channelId;
  const res = await authFetch(`/api/chat/channels/${userId}`);
  if (res.ok) {
    const channels = await res.json();
    currentActiveChannelObj = channels.find(c => c._id === channelId);
    
    const actionContainer = document.getElementById('channelActionBtns');
    actionContainer.innerHTML = '';

    if (currentActiveChannelObj && currentActiveChannelObj.isGroup) {
      const isGroupAdmin = currentActiveChannelObj.adminId === userId;

      if (isGroupAdmin) {
        actionContainer.innerHTML += `
          <button onclick="reassignGroupAdmin('${currentActiveChannelObj._id}')" class="action-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Reassign Admin</button>
          <button onclick="deleteGroupChannel('${currentActiveChannelObj._id}')" class="delete-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete Group</button>
        `;
      }
      actionContainer.innerHTML += `
        <button onclick="leaveGroupChannel('${currentActiveChannelObj._id}')" class="delete-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #444;">Leave Group</button>
      `;
    }

    document.getElementById('activeChatHeader').querySelector('span').innerText = currentActiveChannelObj ? currentActiveChannelObj.name : 'Chat';
  }

  loadMessages(false);
  loadChatChannels();
  loadUnreadBadgeCount();
}

async function leaveGroupChannel(channelId) {
  if (!confirm("Are you sure you want to leave this group chat?")) return;
  const res = await authFetch(`/api/chat/channels/${channelId}/leave`, { method: 'POST' });
  if (res.ok) {
    currentActiveChatId = null;
    document.getElementById('activeChatHeader').querySelector('span').innerText = 'Select a conversation to start chatting';
    document.getElementById('messageHistory').innerHTML = '<p class="empty-msg">No conversation selected.</p>';
    document.getElementById('channelActionBtns').innerHTML = '';
    loadChatChannels();
  }
}

async function reassignGroupAdmin(channelId) {
  const newAdminId = prompt("Enter the User ID of the new Group Admin:");
  if (!newAdminId) return;

  const res = await authFetch(`/api/chat/channels/${channelId}/reassign-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newAdminId })
  });

  if (res.ok) {
    alert("Group Admin reassigned.");
    selectChatChannel(channelId);
  } else {
    alert("Failed to reassign group admin.");
  }
}

async function deleteGroupChannel(channelId) {
  if (!confirm("Are you sure you want to delete this group chat for all members?")) return;
  const res = await authFetch(`/api/chat/channels/${channelId}`, { method: 'DELETE' });
  if (res.ok) {
    currentActiveChatId = null;
    document.getElementById('activeChatHeader').querySelector('span').innerText = 'Select a conversation to start chatting';
    document.getElementById('messageHistory').innerHTML = '<p class="empty-msg">No conversation selected.</p>';
    document.getElementById('channelActionBtns').innerHTML = '';
    loadChatChannels();
  }
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

// MESSAGES LOG & EDITING
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
      const isSiteAdmin = userRole === 'admin';
      const canDelete = isMine || isGroupAdmin || isSiteAdmin;

      return `
        <div style="align-self: ${isMine ? 'flex-end' : 'flex-start'}; max-width: 75%; background: ${isMine ? '#ffffff' : '#1a1a1a'}; color: ${isMine ? '#000000' : '#ffffff'}; padding: 0.6rem 0.8rem; border-radius: 8px;" class="chat-bubble">
          <div style="font-size: 0.7rem; color: ${isMine ? '#555' : '#aaa'}; font-weight: bold; display: flex; justify-content: space-between; gap: 1rem;">
            <span>${m.senderName} ${m.edited ? '(edited)' : ''}</span>
            <div>
              ${isMine ? `<i onclick="editMessagePrompt('${m._id}', '${m.text}')" class="fa-solid fa-pen" style="cursor: pointer; margin-right: 0.4rem;"></i>` : ''}
              ${canDelete ? `<i onclick="deleteMessage('${m._id}')" class="fa-solid fa-trash" style="cursor: pointer; color: #ff5555;"></i>` : ''}
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

// IMAGE ATTACHMENTS
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

// GROUP CREATION MODAL
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

// LINKS & RESOURCES
async function loadResourcesList() {
  const res = await authFetch('/api/resources');
  if (res.ok) {
    const links = await res.json();
    const container = document.getElementById('publicResourcesList');
    if (links.length === 0) {
      container.innerHTML = '<p class="empty-msg">No resource links added yet.</p>';
      return;
    }
    container.innerHTML = links.map(l => `
      <a href="${l.url}" target="_blank" style="text-decoration: none; color: #fff; background: #111; border: 1px solid #222; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.75rem;">
        <i class="fa-solid ${l.icon || 'fa-link'}" style="font-size: 1.25rem;"></i>
        <div>
          <strong>${l.title}</strong>
          <div style="font-size: 0.75rem; color: #888;">Open portal</div>
        </div>
      </a>
    `).join('');

    if (userRole === 'admin') {
      const adminContainer = document.getElementById('adminResourcesList');
      if (adminContainer) {
        adminContainer.innerHTML = links.map(l => `
          <div class="class-summary-item">
            <div><strong>${l.title}</strong> (${l.url})</div>
            <button onclick="deleteResourceLink('${l._id}')" class="delete-btn">Remove</button>
          </div>
        `).join('');
      }
    }
  }
}

const addResForm = document.getElementById('addResourceForm');
if (addResForm) {
  addResForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await authFetch('/api/admin/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: document.getElementById('resTitle').value,
        url: document.getElementById('resUrl').value,
        icon: document.getElementById('resIcon').value
      })
    });
    loadResourcesList();
  });
}

async function deleteResourceLink(id) {
  await authFetch(`/api/admin/resources/${id}`, { method: 'DELETE' });
  loadResourcesList();
}

// DASHBOARD SCHEDULE HELPERS
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

// ADMIN FUNCTIONS
async function applySchedulePreset(preset) {
  if (!confirm(`Apply the ${preset} schedule preset to the entire app?`)) return;
  const res = await authFetch('/api/admin/master-schedule/preset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset })
  });

  if (res.ok) {
    alert("Schedule preset applied successfully!");
    initApp();
  }
}

async function updateUserRole(targetUserId, newRole) {
  await authFetch(`/api/admin/users/${targetUserId}/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: newRole })
  });
  loadAdminData();
}

async function adminResetPassword(targetUserId) {
  const newPassword = prompt("Enter new password for this user:");
  if (!newPassword) return;

  await authFetch(`/api/admin/users/${targetUserId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  });
  alert("Password reset successfully.");
}

async function checkMaintenanceStatus() {
  const res = await authFetch('/api/config/maintenance');
  if (res.ok) {
    const data = await res.json();
    if (userRole === 'admin') {
      const toggle = document.getElementById('maintActiveToggle');
      const notice = document.getElementById('maintNoticeInput');
      const time = document.getElementById('maintTimeInput');
      if (toggle) toggle.checked = data.active || false;
      if (notice) notice.value = data.message || '';
      if (time) time.value = data.estimatedTime || '';
    }
  }
}

const maintForm = document.getElementById('adminMaintenanceForm');
if (maintForm) {
  maintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const active = document.getElementById('maintActiveToggle').checked;
    const message = document.getElementById('maintNoticeInput').value;
    const estimatedTime = document.getElementById('maintTimeInput').value;

    const res = await authFetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active, message, estimatedTime })
    });

    if (res.ok) {
      alert("Maintenance settings saved successfully.");
      checkMaintenanceStatus();
    }
  });
}

async function loadAdminData() {
  checkMaintenanceStatus();
  loadResourcesList();

  const res = await authFetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    document.getElementById('adminUsersTableBody').innerHTML = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>
          <select onchange="updateUserRole('${u._id}', this.value)" style="background:#111; color:#fff; border:1px solid #222; padding:0.3rem; border-radius:4px;">
            <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td style="display: flex; gap: 0.4rem;">
          <button onclick="adminResetPassword('${u._id}')" class="action-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Reset Pass</button>
          <button onclick="deleteUser('${u._id}')" class="delete-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
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
