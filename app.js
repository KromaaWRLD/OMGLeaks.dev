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

// TOAST NOTIFICATION SYSTEM (Feature #4)
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  toast.style.cssText = `
    background: ${type === 'error' ? '#ff3333' : '#ffffff'};
    color: ${type === 'error' ? '#ffffff' : '#000000'};
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
  `;

  const icon = type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

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
    showToast('Unable to connect to server. Check network connection.', 'error');
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Unable to connect to server.' })
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
  const res = await authFetch(`/api/users/${userId}/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarBg: bgColor, avatarColor: textColor })
  });

  if (res.ok) {
    showToast("Profile theme updated!");
  }
}

function applyAvatarStyling(bg, color) {
  const navPfp = document.getElementById('navPfpDisplay');
  const previewPfp = document.getElementById('pfpPreview');

  navPfp.style.background = bg;
  navPfp.style.color = color;
  previewPfp.style.background = bg;
  previewPfp.style.color = color;
}

// USER PROFILE MODAL SYSTEM (Feature #3)
async function openUserProfileModal(targetUserId) {
  const res = await authFetch(`/api/users/${targetUserId}`);
  if (res.ok) {
    const user = await res.json();
    const modal = document.getElementById('userProfileModal');
    
    document.getElementById('modalProfileName').innerText = user.name;
    document.getElementById('modalProfileUsername').innerText = `@${user.username}`;
    document.getElementById('modalProfileRole').innerText = user.role;
    
    // Formatted account creation date
    const createdDate = new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    document.getElementById('modalProfileCreated').innerText = createdDate;

    // Avatar
    const pfp = document.getElementById('modalProfilePfp');
    pfp.innerText = (user.name || 'U').charAt(0).toUpperCase();
    pfp.style.background = user.avatarBg || '#ffffff';
    pfp.style.color = user.avatarColor || '#000000';

    // Verification Badges (Feature #1)
    const badgeContainer = document.getElementById('modalProfileBadgeContainer');
    badgeContainer.innerHTML = '';
    
    if (user.role === 'admin') {
      badgeContainer.innerHTML += `<span style="background: #ffffff; color: #000; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;"><i class="fa-solid fa-shield-halved"></i> Site Admin</span>`;
    }
    
    if (user.verificationBadge && user.verificationBadge !== 'none') {
      let badgeLabel = user.verificationBadge;
      if (badgeLabel === 'verified_staff') badgeLabel = 'Verified Staff';
      if (badgeLabel === 'student_leader') badgeLabel = 'Student Leader';

      badgeContainer.innerHTML += `<span style="background: #5599ff; color: #fff; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;"><i class="fa-solid fa-circle-check"></i> ${badgeLabel}</span>`;
    }

    // Modal Actions (DM option if not self)
    const actions = document.getElementById('modalProfileActions');
    if (user._id !== userId) {
      actions.innerHTML = `
        <button onclick="closeUserProfileModal(); openDirectMessage('${user._id}')" class="action-btn" style="width: 100%; justify-content: center;">
          <i class="fa-solid fa-paper-plane"></i> Send Direct Message
        </button>
      `;
    } else {
      actions.innerHTML = '';
    }

    modal.style.display = 'flex';
  }
}

function closeUserProfileModal() {
  document.getElementById('userProfileModal').style.display = 'none';
}

// DIRECT MESSAGING & CHAT CHANNELS
async function loadDMStudentList() {
  const container = document.getElementById('dmStudentList');
  const res = await authFetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    container.innerHTML = users.filter(u => u._id !== userId).map(u => `
      <div onclick="openUserProfileModal('${u._id}')" style="cursor: pointer; padding: 0.38rem 0.5rem; background: #111; border-radius: 4px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
        <span>${u.name}</span>
        <i class="fa-solid fa-user-circle" style="font-size: 0.8rem; color: #888;"></i>
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
    showToast("Opened Direct Conversation");
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
    showToast("Left group conversation");
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
    showToast("Group Admin reassigned.");
    selectChatChannel(channelId);
  } else {
    showToast("Failed to reassign group admin.", "error");
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
    showToast("Group deleted");
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

// MESSAGES LOG
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
            <span onclick="openUserProfileModal('${m.senderId}')" style="cursor: pointer; text-decoration: underline;">${m.senderName} ${m.edited ? '(edited)' : ''}</span>
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

  const res = await authFetch('/api/chat/messages', {
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

  if (res.ok) {
    input.value = '';
    cancelImageAttachment();
    sendTypingSignal(false);
    loadMessages(false);
    loadUnreadBadgeCount();
  } else {
    showToast("Failed to send message", "error");
  }
});

async function editMessagePrompt(msgId, currentText) {
  const newText = prompt("Edit your message:", currentText);
  if (newText === null || newText.trim() === "") return;

  const res = await authFetch(`/api/chat/messages/${msgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: newText.trim(), senderId: userId })
  });

  if (res.ok) {
    showToast("Message updated");
    loadMessages(false);
  }
}

async function deleteMessage(msgId) {
  if (!confirm("Delete this message?")) return;
  const res = await authFetch(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("Message removed");
    loadMessages(false);
  }
}

// GROUP CREATION MODAL
document.getElementById('openGroupModalBtn').addEventListener('click', async () => {
  const modal = document.getElementById('groupModal');
  const userCheckboxes = document.getElementById('groupUserCheckboxes');
  
  const res = await authFetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    userCheckboxes.innerHTML = users.
