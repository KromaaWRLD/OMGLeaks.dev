let userId = localStorage.getItem('uhs_user_id');
let userRole = localStorage.getItem('uhs_user_role');

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
let profilePfpBase64 = null;
let selectedModalUserId = null;

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// INSTANT ROLE PERMISSION SYNC
function updateRoleUI(newRole) {
  if (userRole !== newRole) {
    userRole = newRole;
    localStorage.setItem('uhs_user_role', newRole);
    showToast(`Permissions updated: Role is now ${newRole.toUpperCase()}`, 'info');
  }

  if (adminNavItem) {
    if (userRole === 'admin') {
      adminNavItem.style.display = 'flex';
    } else {
      adminNavItem.style.display = 'none';
      if (document.getElementById('view-admin').style.display !== 'none') {
        document.querySelector('[data-path="dashboard"]').click();
      }
    }
  }
}

if (adminNavItem && userRole === 'admin') {
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

// TOAST NOTIFICATION SYSTEM
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let icon = 'fa-info-circle';
  let borderBg = '#222';
  if (type === 'success') { icon = 'fa-circle-check'; borderBg = '#55ff55'; }
  if (type === 'error') { icon = 'fa-triangle-exclamation'; borderBg = '#ff5555'; }

  toast.style.cssText = `
    background: #111111;
    color: #ffffff;
    border-left: 4px solid ${borderBg};
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 220px;
    pointer-events: auto;
    animation: fadeIn 0.3s ease;
  `;

  toast.innerHTML = `<i class="fa-solid ${icon}" style="color: ${borderBg}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Custom Fetch Wrapper
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
    showToast('Network error while reaching server.', 'error');
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

    if (path === 'suggestions') loadSuggestionsList();
    if (path === 'resources') loadResourcesList();
    if (path === 'admin') loadAdminData();
    if (sidenav.classList.contains('open')) toggleSidebar();
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    stopLiveChatPolling();
    localStorage.clear();
    showToast('Logged out successfully', 'info');
    setTimeout(() => window.location.href = 'login.html', 500);
  });
}

// INITIALIZATION & REAL-TIME BACKGROUND POLLING
async function initApp() {
  if (!userId) return;

  const userRes = await authFetch(`/api/users/${userId}`);
  if (userRes.ok) {
    const user = await userRes.json();
    document.getElementById('userName').innerText = user.name;
    document.getElementById('editDisplayName').value = user.name;
    document.getElementById('editUsername').value = user.username;
    
    if (user.chatBgColor) document.getElementById('editChatBg').value = user.chatBgColor;
    if (user.chatBubbleColor) document.getElementById('editBubbleBg').value = user.chatBubbleColor;
    if (user.chatBgColor) document.getElementById('chatWorkspace').style.background = user.chatBgColor;

    updateRoleUI(user.role);
    renderUserPfp(user);
  }

  // Check automated recurring weekday schedule rules
  await authFetch('/api/master-schedule/check-day-rules', { method: 'POST' });

  const [masterRes, announcementRes] = await Promise.all([
    authFetch('/api/master-schedule'),
    authFetch('/api/announcements/latest')
  ]);

  const masterData = masterRes.ok ? await masterRes.json() : { presetName: 'Standard Bell Schedule', slots: [] };
  
  cachedMasterSchedule = masterData.slots || [];
  const scheduleName = masterData.presetName || 'Standard Bell Schedule';
  document.getElementById('schedulePresetTitle').innerText = scheduleName;
  document.getElementById('dashTodayStatus').innerText = scheduleName;
  document.getElementById('dashTodayStatus').style.color = '#55ff55';

  if (announcementRes.ok) {
    const announcement = await announcementRes.json();
    const banner = document.getElementById('announcementBanner');
    if (announcement && announcement.text) {
      document.getElementById('announcementText').innerText = announcement.text;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  renderMasterSchedule(cachedMasterSchedule);
  startPeriodCountdown();

  loadActivePoll();
  loadUnreadBadgeCount();

  setInterval(backgroundRealtimeSync, 3000);

  if (userRole === 'admin') loadAdminData();
}

function renderUserPfp(user) {
  const navPfp = document.getElementById('navPfpDisplay');
  if (user.pfpUrl) {
    navPfp.style.backgroundImage = `url(${user.pfpUrl})`;
    navPfp.innerText = '';
  } else {
    navPfp.style.backgroundImage = 'none';
    navPfp.innerText = (user.name || 'U').charAt(0).toUpperCase();
  }
}

async function backgroundRealtimeSync() {
  if (!userId) return;

  const res = await authFetch(`/api/users/${userId}`);
  if (res.ok) {
    const user = await res.json();
    if (user && user.role) updateRoleUI(user.role);
  }

  loadUnreadBadgeCount();

  if (document.getElementById('view-admin').style.display !== 'none' && userRole === 'admin') {
    loadAdminData();
  }
}

// PROFILE UPDATES & 7-DAY USERNAME RULE
document.getElementById('pfpFileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    profilePfpBase64 = evt.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('updateProfileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('editDisplayName').value.trim();
  const newUsername = document.getElementById('editUsername').value.trim();
  const chatBgColor = document.getElementById('editChatBg').value;
  const chatBubbleColor = document.getElementById('editBubbleBg').value;

  const res = await authFetch(`/api/users/${userId}/update-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      newUsername,
      pfpUrl: profilePfpBase64 !== null ? profilePfpBase64 : undefined,
      chatBgColor,
      chatBubbleColor
    })
  });

  if (res.ok) {
    showToast('Profile settings saved successfully!', 'success');
    initApp();
  } else {
    const err = await res.json();
    showToast(err.error || 'Failed to update profile.', 'error');
  }
});

// BROADCAST ANNOUNCEMENT LOGIC
const broadcastForm = document.getElementById('broadcastAnnouncementForm');
if (broadcastForm) {
  broadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('announcementInput').value.trim();
    if (!text) return;

    const res = await authFetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      document.getElementById('announcementInput').value = '';
      showToast('Announcement broadcasted!', 'success');
      initApp();
    }
  });
}

// RECURRING WEEKDAY SCHEDULE RULES
const addDayRuleForm = document.getElementById('addDayRuleForm');
if (addDayRuleForm) {
  addDayRuleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dayOfWeek = parseInt(document.getElementById('ruleWeekdaySelect').value);
    const preset = document.getElementById('rulePresetSelect').value;

    const res = await authFetch('/api/admin/day-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek, preset })
    });

    if (res.ok) {
      showToast(`Rule added! ${weekdayNames[dayOfWeek]}s now default to ${preset}`, 'success');
      initApp();
      loadAdminDayRules();
    }
  });
}

async function loadAdminDayRules() {
  const container = document.getElementById('adminDayRulesList');
  if (!container) return;

  const res = await authFetch('/api/admin/day-rules');
  if (res.ok) {
    const rules = await res.json();
    if (rules.length === 0) {
      container.innerHTML = '<p class="empty-msg">No recurring weekday rules set. Add one above!</p>';
      return;
    }

    container.innerHTML = rules.map(r => `
      <div class="class-summary-item">
        <div>
          <strong>${weekdayNames[r.dayOfWeek]}s</strong> automatically set to
          <span style="color: #ffaa00; font-weight: bold;">${r.preset.toUpperCase()}</span> schedule
        </div>
        <button onclick="deleteDayRule('${r._id}')" class="delete-btn">Remove Rule</button>
      </div>
    `).join('');
  }
}

async function deleteDayRule(id) {
  const res = await authFetch(`/api/admin/day-rules/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Weekday rule removed', 'info');
    initApp();
    loadAdminDayRules();
  }
}

// COMMUNITY POLL SYSTEM WITH ADMIN STATS
async function loadActivePoll() {
  const container = document.getElementById('activePollContainer');
  const res = await authFetch('/api/polls/active');
  if (!res.ok) return container.innerHTML = '<p class="empty-msg">Error loading poll.</p>';

  const poll = await res.json();
  if (!poll) {
    container.innerHTML = '<p class="empty-msg">No active community poll right now. Check back later!</p>';
    return;
  }

  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
  const userVotedOptionIndex = poll.options.findIndex(opt => opt.votes && opt.votes.includes(userId));

  container.innerHTML = `
    <div style="font-weight: bold; font-size: 1rem; margin-bottom: 0.75rem;">${poll.question}</div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      ${poll.options.map((opt, idx) => {
        const votes = opt.votes ? opt.votes.length : 0;
        const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        const isUserPick = userVotedOptionIndex === idx;

        return `
          <div onclick="submitPollVote('${poll._id}', ${idx})" style="cursor: pointer; background: #111; border: 1px solid ${isUserPick ? '#ffaa00' : '#222'}; padding: 0.6rem; border-radius: 6px; position: relative; overflow: hidden;">
            <div style="position: absolute; top:0; left:0; bottom:0; width: ${pct}%; background: rgba(255, 170, 0, 0.15); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; font-size: 0.85rem;">
              <span>${isUserPick ? '<i class="fa-solid fa-circle-check" style="color:#ffaa00;"></i> ' : ''}${opt.text}</span>
              <span style="font-weight: bold; color: #aaa;">${pct}% (${votes})</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="font-size: 0.75rem; color: #888; margin-top: 0.5rem; text-align: right;">Total Votes: ${totalVotes}</div>
  `;
}

async function submitPollVote(pollId, optionIndex) {
  const res = await authFetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionIndex })
  });

  if (res.ok) {
    showToast('Vote recorded!', 'success');
    loadActivePoll();
  } else {
    showToast('Failed to record vote.', 'error');
  }
}

// ADMIN POLL MANAGEMENT WITH LIVE ANALYTICS
const createPollForm = document.getElementById('createPollForm');
if (createPollForm) {
  createPollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = document.getElementById('pollQuestionInput').value.trim();
    const rawOptions = document.getElementById('pollOptionsInput').value;
    const options = rawOptions.split(',').map(o => o.trim()).filter(o => o.length > 0);

    if (options.length < 2) return showToast('Please enter at least 2 options.', 'error');

    const res = await authFetch('/api/admin/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options })
    });

    if (res.ok) {
      document.getElementById('pollQuestionInput').value = '';
      document.getElementById('pollOptionsInput').value = '';
      showToast('Poll created and set active!', 'success');
      loadActivePoll();
      loadAdminPolls();
    }
  });
}

async function loadAdminPolls() {
  const container = document.getElementById('adminPollsList');
  if (!container) return;

  const res = await authFetch('/api/admin/polls');
  if (res.ok) {
    const polls = await res.json();
    if (polls.length === 0) {
      container.innerHTML = '<p class="empty-msg">No polls created yet.</p>';
      return;
    }

    container.innerHTML = polls.map(p => {
      const totalVotes = p.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);

      return `
        <div class="class-summary-item" style="flex-direction: column; align-items: flex-start; gap: 0.6rem;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <div>
              <strong>${p.question}</strong>
              ${p.active ? '<span style="color:#55ff55; font-size: 0.75rem; margin-left: 0.5rem; font-weight: bold;">(Active Poll)</span>' : '<span style="color:#888; font-size: 0.75rem; margin-left: 0.5rem;">(Inactive)</span>'}
            </div>
            <div style="display: flex; gap: 0.4rem;">
              ${!p.active ? `<button onclick="setPollActive('${p._id}')" class="action-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Make Active</button>` : ''}
              <button onclick="deletePoll('${p._id}')" class="delete-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
            </div>
          </div>

          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.25rem;">
            ${p.options.map(opt => {
              const votes = opt.votes ? opt.votes.length : 0;
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              return `
                <div style="font-size: 0.8rem; display: flex; justify-content: space-between; background: #111; padding: 0.3rem 0.6rem; border-radius: 4px;">
                  <span>${opt.text}</span>
                  <span style="color: #ffaa00; font-weight: bold;">${pct}% (${votes} votes)</span>
                </div>
              `;
            }).join('')}
          </div>
          <div style="font-size: 0.75rem; color: #666; align-self: flex-end;">Total Votes Collected: ${totalVotes}</div>
        </div>
      `;
    }).join('');
  }
}

async function setPollActive(pollId) {
  const res = await authFetch(`/api/admin/polls/${pollId}/activate`, { method: 'POST' });
  if (res.ok) {
    showToast('Active poll updated', 'success');
    loadActivePoll();
    loadAdminPolls();
  }
}

async function deletePoll(pollId) {
  if (!confirm("Delete this poll?")) return;
  const res = await authFetch(`/api/admin/polls/${pollId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Poll deleted', 'info');
    loadActivePoll();
    loadAdminPolls();
  }
}

// SUGGESTION & FEEDBACK TAB LOGIC
document.getElementById('submitSuggestionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('suggestionTitle').value.trim();
  const description = document.getElementById('suggestionDesc').value.trim();

  if (!title || !description) return;

  const res = await authFetch('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      authorName: document.getElementById('userName').innerText,
      authorId: userId
    })
  });

  if (res.ok) {
    document.getElementById('suggestionTitle').value = '';
    document.getElementById('suggestionDesc').value = '';
    showToast('Suggestion submitted!', 'success');
    loadSuggestionsList();
  }
});

async function loadSuggestionsList() {
  const container = document.getElementById('publicSuggestionsList');
  const res = await authFetch('/api/suggestions');
  if (!res.ok) return container.innerHTML = '<p class="empty-msg">Error loading suggestions.</p>';

  const suggestions = await res.json();
  if (suggestions.length === 0) {
    container.innerHTML = '<p class="empty-msg">No suggestions submitted yet. Be the first!</p>';
    return;
  }

  container.innerHTML = suggestions.map(s => {
    const isOwner = s.authorId === userId;
    const canManage = userRole === 'admin' || isOwner;

    return `
      <div class="class-summary-item" style="flex-direction: column; align-items: flex-start; gap: 0.4rem;">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <strong>${s.title}</strong>
          <span style="font-size: 0.75rem; background: #222; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold; color: ${s.status === 'Approved' ? '#55ff55' : s.status === 'Rejected' ? '#ff5555' : '#ffaa00'};">${s.status}</span>
        </div>
        <p style="font-size: 0.85rem; color: #ccc; margin: 0; white-space: pre-wrap;">${s.description}</p>
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-top: 0.25rem;">
          <span style="font-size: 0.75rem; color: #777;">By: <span onclick="openProfileModal('${s.authorId}')" style="cursor: pointer; text-decoration: underline;">${s.authorName}</span></span>
          <div style="display: flex; gap: 0.4rem;">
            ${userRole === 'admin' ? `
              <button onclick="updateSuggestionStatus('${s._id}', 'Approved')" class="action-btn" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; background: #225522;">Approve</button>
              <button onclick="updateSuggestionStatus('${s._id}', 'Rejected')" class="delete-btn" style="padding: 0.2rem 0.4rem; font-size: 0.75rem;">Reject</button>
            ` : ''}
            ${canManage ? `<button onclick="deleteSuggestion('${s._id}')" class="delete-btn" style="padding: 0.2rem 0.4rem; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function updateSuggestionStatus(id, status) {
  const res = await authFetch(`/api/admin/suggestions/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (res.ok) {
    showToast(`Suggestion marked as ${status}`, 'info');
    loadSuggestionsList();
  }
}

async function deleteSuggestion(id) {
  if (!confirm("Delete this suggestion?")) return;
  const res = await authFetch(`/api/suggestions/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Suggestion deleted', 'info');
    loadSuggestionsList();
  }
}

// PROFILE MODAL & BADGE ICON MAPPING
function getBadgeIcon(badgeText) {
  const lower = badgeText.toLowerCase();
  if (lower.includes('staff') || lower.includes('admin') || lower.includes('teacher')) return 'fa-shield-halved';
  if (lower.includes('council') || lower.includes('leader') || lower.includes('president')) return 'fa-crown';
  if (lower.includes('honor') || lower.includes('scholar') || lower.includes('gpa')) return 'fa-award';
  if (lower.includes('verified')) return 'fa-circle-check';
  if (lower.includes('athlete') || lower.includes('sports') || lower.includes('captain')) return 'fa-trophy';
  if (lower.includes('art') || lower.includes('drama') || lower.includes('music')) return 'fa-palette';
  return 'fa-star'; // Basic default icon for custom badges
}

async function openProfileModal(targetUserId) {
  selectedModalUserId = targetUserId;
  const res = await authFetch(`/api/users/${targetUserId}`);
  if (!res.ok) return showToast('Could not load profile.', 'error');

  const user = await res.json();
  
  const pfp = document.getElementById('modalPfp');
  if (user.pfpUrl) {
    pfp.style.backgroundImage = `url(${user.pfpUrl})`;
    pfp.innerText = '';
  } else {
    pfp.style.backgroundImage = 'none';
    pfp.innerText = (user.name || 'U').charAt(0).toUpperCase();
    pfp.style.background = user.avatarBg || '#ffffff';
    pfp.style.color = user.avatarColor || '#000000';
  }

  document.getElementById('modalName').innerText = user.name;
  document.getElementById('modalUsername').innerText = `@${user.username}`;
  document.getElementById('modalRoleBadge').innerText = user.role || 'STUDENT';

  const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
  document.getElementById('modalCreatedDate').innerText = createdDate;

  renderModalBadges(user.badges || []);

  const adminControls = document.getElementById('adminBadgeControls');
  adminControls.style.display = (userRole === 'admin') ? 'block' : 'none';

  document.getElementById('userProfileModal').style.display = 'flex';
}

function renderModalBadges(badges) {
  const listContainer = document.getElementById('modalBadgesList');
  if (!badges || badges.length === 0) {
    listContainer.innerHTML = '<span style="font-size: 0.75rem; color: #666;">No verification badges assigned.</span>';
    return;
  }

  listContainer.innerHTML = badges.map(b => `
    <span style="background: #111; border: 1px solid #333; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; color: #ffaa00; display: inline-flex; align-items: center; gap: 0.35rem;">
      <i class="fa-solid ${getBadgeIcon(b)}"></i> ${b}
      ${userRole === 'admin' ? `<i onclick="removeBadgeFromUser('${b}')" class="fa-solid fa-xmark" style="cursor: pointer; color: #ff5555; margin-left: 0.2rem;"></i>` : ''}
    </span>
  `).join('');
}

function closeProfileModal() {
  document.getElementById('userProfileModal').style.display = 'none';
  selectedModalUserId = null;
}

async function addBadgeToUser() {
  if (!selectedModalUserId) return;
  const input = document.getElementById('newBadgeInput');
  const badgeText = input.value.trim();
  if (!badgeText) return;

  const res = await authFetch(`/api/admin/users/${selectedModalUserId}/badges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badge: badgeText })
  });

  if (res.ok) {
    const data = await res.json();
    input.value = '';
    renderModalBadges(data.badges);
    showToast('Badge added to user', 'success');
  }
}

async function removeBadgeFromUser(badgeText) {
  if (!selectedModalUserId) return;

  const res = await authFetch(`/api/admin/users/${selectedModalUserId}/badges`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ badge: badgeText })
  });

  if (res.ok) {
    const data = await res.json();
    renderModalBadges(data.badges);
    showToast('Badge removed', 'info');
  }
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

// CHAT & DIRECT MESSAGING
async function loadDMStudentList() {
  const container = document.getElementById('dmStudentList');
  const res = await authFetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    container.innerHTML = users.filter(u => u._id !== userId).map(u => `
      <div style="cursor: pointer; padding: 0.38rem 0.5rem; background: #111; border-radius: 4px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;" onclick="openDirectMessage('${u._id}')">
        <span onclick="event.stopPropagation(); openProfileModal('${u._id}')" style="color: #fff; text-decoration: underline;">${u.name}</span>
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
    await loadChatChannels();
    selectChatChannel(channel._id);
    showToast('Direct message opened', 'info');
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

  // Instantly load messages upon channel click
  await loadMessages(false);
  renderChatChannelsList(await (await authFetch(`/api/chat/channels/${userId}`)).json());
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
    showToast('Left group chat', 'info');
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
    showToast('Group Admin reassigned', 'success');
    selectChatChannel(channelId);
  } else {
    showToast('Failed to reassign group admin', 'error');
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
    showToast('Group deleted', 'info');
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
      banner.innerText = `${data.typers.join(', ')} ${data.typers.length > 1 ? 'are' : 'is'} yapping...`;
    } else {
      banner.innerText = '';
    }
  }
}

// MESSAGES HISTORY RENDER WITH PFP AVATARS, TIMESTAMPS, AND CUSTOM BUBBLES
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

      const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const bubbleBg = isMine ? (m.senderBubbleColor || '#ffffff') : '#1a1a1a';
      const textColor = isMine ? (bubbleBg === '#ffffff' ? '#000000' : '#ffffff') : '#ffffff';

      // PFP Avatar Element
      const pfpStyle = m.senderPfpUrl 
        ? `background-image: url(${m.senderPfpUrl}); background-size: cover; background-position: center; color: transparent;` 
        : `background: #ffffff; color: #000000;`;
      const pfpInitial = m.senderPfpUrl ? '' : (m.senderName || 'U').charAt(0).toUpperCase();
      
      const pfpAvatarHtml = `
        <div onclick="openProfileModal('${m.senderId}')" style="width: 32px; height: 32px; border-radius: 50%; ${pfpStyle} display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; cursor: pointer; flex-shrink: 0;">
          ${pfpInitial}
        </div>
      `;

      return `
        <div style="display: flex; gap: 0.6rem; align-items: flex-end; justify-content: ${isMine ? 'flex-end' : 'flex-start'};">
          ${!isMine ? pfpAvatarHtml : ''}
          <div style="max-width: 75%; background: ${bubbleBg}; color: ${textColor}; padding: 0.6rem 0.8rem; border-radius: 8px;">
            <div style="font-size: 0.7rem; color: ${isMine ? '#888' : '#aaa'}; font-weight: bold; display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.2rem;">
              <span onclick="openProfileModal('${m.senderId}')" style="cursor: pointer; text-decoration: underline;">${m.senderName} ${m.edited ? '(edited)' : ''}</span>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-size: 0.65rem; opacity: 0.8;">${timeStr}</span>
                ${isMine ? `<i onclick="editMessagePrompt('${m._id}', '${m.text}')" class="fa-solid fa-pen" style="cursor: pointer;"></i>` : ''}
                ${canDelete ? `<i onclick="deleteMessage('${m._id}')" class="fa-solid fa-trash" style="cursor: pointer; color: #ff5555;"></i>` : ''}
              </div>
            </div>
            ${m.text ? `<div style="word-break: break-word;">${m.text}</div>` : ''}
            ${m.imageUrl ? `<img src="${m.imageUrl}" style="max-width: 100%; max-height: 200px; border-radius: 6px; margin-top: 0.5rem; display: block;">` : ''}
          </div>
          ${isMine ? pfpAvatarHtml : ''}
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

// Submit Message Handler (Allows Image-Only or Text-Only)
document.getElementById('sendMessageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentActiveChatId) return showToast('Please select a chat channel first.', 'error');

  const input = document.getElementById('chatInput');
  const text = input.value.trim();

  // Block sending only if BOTH text and image attachment are empty
  if (!text && !attachedBase64Image) return;

  const res = await authFetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: currentActiveChatId,
      senderId: userId,
      senderName: document.getElementById('userName').innerText,
      text: text, // Can be an empty string if only sending an image
      imageUrl: attachedBase64Image
    })
  });

  if (res.ok) {
    input.value = '';
    cancelImageAttachment();
    sendTypingSignal(false);
    loadMessages(false);
    loadUnreadBadgeCount();
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
    loadMessages(false);
    showToast('Message edited', 'success');
  }
}

async function deleteMessage(msgId) {
  if (!confirm("Delete this message?")) return;
  const res = await authFetch(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
  if (res.ok) {
    loadMessages(false);
    showToast('Message removed', 'info');
  }
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

  const res = await authFetch('/api/chat/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: groupName,
      isGroup: true,
      members: memberIds,
      adminId: userId
    })
  });

  if (res.ok) {
    closeGroupModal();
    loadChatChannels();
    showToast('Group chat created!', 'success');
  }
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
    const res = await authFetch('/api/admin/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: document.getElementById('resTitle').value,
        url: document.getElementById('resUrl').value,
        icon: document.getElementById('resIcon').value
      })
    });
    if (res.ok) {
      loadResourcesList();
      showToast('Resource added', 'success');
    }
  });
}

async function deleteResourceLink(id) {
  const res = await authFetch(`/api/admin/resources/${id}`, { method: 'DELETE' });
  if (res.ok) {
    loadResourcesList();
    showToast('Resource removed', 'info');
  }
}

// DASHBOARD SCHEDULE HELPERS
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

// ADMIN FUNCTIONS
async function applySchedulePreset(preset) {
  if (!confirm(`Apply the ${preset} schedule preset to the entire app?`)) return;
  const res = await authFetch('/api/admin/master-schedule/preset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset })
  });

  if (res.ok) {
    showToast(`Preset "${preset}" applied!`, 'success');
    initApp();
  }
}

async function updateUserRole(targetUserId, newRole) {
  const res = await authFetch(`/api/admin/users/${targetUserId}/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: newRole })
  });
  if (res.ok) {
    showToast('Role updated! Take effect on user end in 3s.', 'success');
    loadAdminData();
  }
}

async function adminResetUsername(targetUserId, currentUsername) {
  const newUsername = prompt("Enter new username for this user:", currentUsername);
  if (!newUsername || newUsername.trim() === "") return;

  const res = await authFetch(`/api/admin/users/${targetUserId}/reset-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newUsername: newUsername.trim() })
  });

  if (res.ok) {
    showToast('Username reset successfully!', 'success');
    loadAdminData();
  } else {
    const err = await res.json();
    showToast(err.error || 'Failed to reset username.', 'error');
  }
}

async function adminResetPassword(targetUserId) {
  const newPassword = prompt("Enter new password for this user:");
  if (!newPassword) return;

  const res = await authFetch(`/api/admin/users/${targetUserId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword })
  });
  if (res.ok) showToast('Password reset successfully', 'success');
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
      showToast('Maintenance settings saved', 'success');
      checkMaintenanceStatus();
    }
  });
}

async function loadAdminData() {
  checkMaintenanceStatus();
  loadResourcesList();
  loadAdminPolls();
  loadAdminDayRules();

  const res = await authFetch('/api/admin/users');
  if (res.ok) {
    const users = await res.json();
    document.getElementById('adminUsersTableBody').innerHTML = users.map(u => `
      <tr>
        <td><span onclick="openProfileModal('${u._id}')" style="cursor: pointer; text-decoration: underline;">${u.username}</span></td>
        <td>${u.name}</td>
        <td>
          <select onchange="updateUserRole('${u._id}', this.value)" style="background:#111; color:#fff; border:1px solid #222; padding:0.3rem; border-radius:4px;">
            <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td style="display: flex; gap: 0.4rem;">
          <button onclick="adminResetUsername('${u._id}', '${u.username}')" class="action-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #5599ff; color: #fff;">Edit Username</button>
          <button onclick="adminResetPassword('${u._id}')" class="action-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Reset Pass</button>
          <button onclick="deleteUser('${u._id}')" class="delete-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </td>
      </tr>
    `).join('');
  }
}

async function deleteUser(id) {
  if (confirm("Delete this user account?")) {
    const res = await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('User account deleted', 'info');
      loadAdminData();
    }
  }
}
// ==========================================
// EMOJI & GIF PICKER LOGIC
// ==========================================
const commonEmojis = ['😂', '💀', '🔥', '😭', '👍', '❤️', '😎', '🎉', '🤡', '👀', '💯', '🙏', '🫡', '🙄', '✨'];

const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const gifBtn = document.getElementById('gifBtn');
const gifPicker = document.getElementById('gifPicker');
const chatInput = document.getElementById('chatInput');

// 1. Populate the Emoji Grid
if (emojiPicker) {
  emojiPicker.innerHTML = commonEmojis.map(emoji => `
    <span onclick="insertEmoji('${emoji}')" style="font-size: 1.25rem; cursor: pointer; text-align: center; padding: 0.2rem; display: inline-block;">${emoji}</span>
  `).join('');
}

// 2. Toggle Menus
if (emojiBtn) {
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    gifPicker.style.display = 'none';
    emojiPicker.style.display = (emojiPicker.style.display === 'grid') ? 'none' : 'grid';
  });
}

if (gifBtn) {
  gifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.style.display = 'none';
    gifPicker.style.display = (gifPicker.style.display === 'block') ? 'none' : 'block';
  });
}

// Close pickers if clicking outside
document.addEventListener('click', (e) => {
  if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
    emojiPicker.style.display = 'none';
  }
  if (gifPicker && !gifPicker.contains(e.target) && e.target !== gifBtn) {
    gifPicker.style.display = 'none';
  }
});

// 3. Insert Emoji into Input Field
function insertEmoji(emoji) {
  chatInput.value += emoji;
  emojiPicker.style.display = 'none';
  chatInput.focus();
}

// 4. Live GIF Search
const gifSearchInput = document.getElementById('gifSearchInput');
if (gifSearchInput) {
  let gifDebounce = null;
  gifSearchInput.addEventListener('input', (e) => {
    clearTimeout(gifDebounce);
    const query = e.target.value.trim();
    if (!query) return;

    gifDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=Y6D0pSM24Z6dfKuUB9epG3Sd0ajcC2ro&q=${encodeURIComponent(query)}&limit=6`);
        const data = await res.json();
        const resultsContainer = document.getElementById('gifResults');
        
        if (data.data && data.data.length > 0) {
          resultsContainer.innerHTML = data.data.map(g => `
            <img src="${g.images.fixed_height_small.url}" onclick="sendGifMessage('${g.images.fixed_height.url}')" style="width: 100%; height: 70px; object-fit: cover; border-radius: 4px; cursor: pointer;">
          `).join('');
        } else {
          resultsContainer.innerHTML = '<p style="font-size: 0.75rem; color: #888; grid-column: span 2; text-align: center;">No GIFs found.</p>';
        }
      } catch (err) {
        console.error('GIF fetch error:', err);
      }
    }, 400);
  });
}

// 5. Send Selected GIF Directly
async function sendGifMessage(gifUrl) {
  gifPicker.style.display = 'none';
  if (!currentActiveChatId) return showToast('Select a chat channel first.', 'error');

  const res = await authFetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: currentActiveChatId,
      senderId: userId,
      senderName: document.getElementById('userName').innerText,
      text: '',
      imageUrl: gifUrl
    })
  });

  if (res.ok) {
    loadMessages(false);
  }
}


initApp();
