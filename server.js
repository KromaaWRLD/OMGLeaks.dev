const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname)));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Uploaded file or image is too large. Please choose a smaller file.' });
  }
  next();
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
})
.then(() => console.log('✅ Connected to MongoDB Atlas (coldwinters)'))
.catch((err) => {
  console.error('❌ MongoDB Connection Error Details:', err.message);
});

// SCHEMAS & MODELS
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'student' },
  avatarBg: { type: String, default: '#ffffff' },
  avatarColor: { type: String, default: '#000000' },
  badges: [{ type: String }]
}, { timestamps: true });

const CalendarEventSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  isDayOff: { type: Boolean, default: true },
  title: String
});

const MasterScheduleSchema = new mongoose.Schema({
  period: String,
  startTime: String,
  endTime: String,
  label: String
});
// Updated UserSchema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'student' },
  avatarBg: { type: String, default: '#ffffff' },
  avatarColor: { type: String, default: '#000000' },
  pfpUrl: { type: String, default: '' }, // Custom PFP image URL
  chatBgColor: { type: String, default: '#0a0a0a' }, // Custom Chat Background
  chatBubbleColor: { type: String, default: '#1a1a1a' }, // Custom Bubble Color
  lastUsernameChange: { type: Date, default: null }, // 7-day restriction tracker
  badges: [{ type: String }]
}, { timestamps: true });

// Announcement Schema
const AnnouncementSchema = new mongoose.Schema({
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', AnnouncementSchema);

// RECURRING DAY RULES SCHEMA
const DayRuleSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, unique: true }, // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  preset: { type: String, required: true }
});

const ChatChannelSchema = new mongoose.Schema({
  name: String,
  isGroup: { type: Boolean, default: false },
  members: [String],
  adminId: String
});

const ChatMessageSchema = new mongoose.Schema({
  channelId: String,
  senderId: String,
  senderName: String,
  text: String,
  imageUrl: String,
  edited: { type: Boolean, default: false },
  readBy: [String],
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

const ResourceLinkSchema = new mongoose.Schema({
  title: String,
  url: String,
  icon: String
});

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{
    text: String,
    votes: [String]
  }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

const SuggestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  authorName: String,
  authorId: String,
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

const SystemConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', UserSchema);
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);
const MasterSchedule = mongoose.model('MasterSchedule', MasterScheduleSchema);
const DayRule = mongoose.model('DayRule', DayRuleSchema);
const ChatChannel = mongoose.model('ChatChannel', ChatChannelSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const ResourceLink = mongoose.model('ResourceLink', ResourceLinkSchema);
const Poll = mongoose.model('Poll', PollSchema);
const Suggestion = mongoose.model('Suggestion', SuggestionSchema);
const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

const typingState = {};

// RECURRING DAY RULES LOADER HELPER
async function generatePresetSlots(preset) {
  switch (preset) {
    case 'climbertime':
      return [
        { period: '1st Period', startTime: '07:35 AM', endTime: '08:15 AM', label: 'Class Period' },
        { period: '2nd Period', startTime: '08:19 AM', endTime: '08:59 AM', label: 'Class Period' },
        { period: '3rd Period', startTime: '09:03 AM', endTime: '09:43 AM', label: 'Class Period' },
        { period: 'ClimberTime', startTime: '09:47 AM', endTime: '10:43 AM', label: 'ClimberTime Period' },
        { period: '4th Period', startTime: '10:47 AM', endTime: '11:27 AM', label: 'Class Period' },
        { period: '5th Period (Lunch)', startTime: '11:31 AM', endTime: '12:16 PM', label: '1st Lunch' },
        { period: '6th Period (2nd Lunch)', startTime: '12:20 PM', endTime: '01:05 PM', label: '2nd Lunch' },
        { period: '7th Period', startTime: '01:09 PM', endTime: '01:49 PM', label: 'Class Period' },
        { period: '8th Period', startTime: '01:53 PM', endTime: '02:37 PM', label: 'Class Period' }
      ];
    case 'delay2hr':
      return [
        { period: '1st Period', startTime: '09:35 AM', endTime: '10:05 AM', label: '2-Hr Delay Class' },
        { period: '2nd Period', startTime: '10:09 AM', endTime: '10:39 AM', label: '2-Hr Delay Class' },
        { period: '3rd Period', startTime: '10:43 AM', endTime: '11:13 AM', label: '2-Hr Delay Class' },
        { period: '4th Period', startTime: '11:17 AM', endTime: '11:47 AM', label: '2-Hr Delay Class' },
        { period: '5th Period (Lunch)', startTime: '11:51 AM', endTime: '12:36 PM', label: '1st Lunch' },
        { period: '6th Period (2nd Lunch)', startTime: '12:40 PM', endTime: '01:25 PM', label: '2nd Lunch' },
        { period: '7th Period', startTime: '01:29 PM', endTime: '01:59 PM', label: '2-Hr Delay Class' },
        { period: '8th Period', startTime: '02:03 PM', endTime: '02:37 PM', label: '2-Hr Delay Class' }
      ];
    case 'pm_assembly':
      return [
        { period: '1st Period', startTime: '07:35 AM', endTime: '08:20 AM', label: 'Class Period' },
        { period: '2nd Period', startTime: '08:24 AM', endTime: '09:09 AM', label: 'Class Period' },
        { period: '3rd Period', startTime: '09:13 AM', endTime: '09:58 AM', label: 'Class Period' },
        { period: '4th Period', startTime: '10:02 AM', endTime: '10:47 AM', label: 'Class Period' },
        { period: '5th Period', startTime: '10:51 AM', endTime: '11:36 AM', label: '1st Lunch' },
        { period: '6th Period', startTime: '11:40 AM', endTime: '12:25 PM', label: '2nd Lunch' },
        { period: '7th Period', startTime: '12:29 PM', endTime: '01:13 PM', label: 'Class Period' },
        { period: '8th Period', startTime: '01:17 PM', endTime: '02:01 PM', label: 'Class Period' },
        { period: 'Activity Period', startTime: '02:05 PM', endTime: '02:37 PM', label: 'Assembly / Pep Rally' }
      ];
    case 'activity':
      return [
        { period: '1st Period', startTime: '07:35 AM', endTime: '08:15 AM', label: 'Class Period' },
        { period: '2nd Period', startTime: '08:19 AM', endTime: '08:58 AM', label: 'Class Period' },
        { period: '3rd Period', startTime: '09:02 AM', endTime: '09:41 AM', label: 'Class Period' },
        { period: '4th Period', startTime: '09:45 AM', endTime: '10:24 AM', label: 'Class Period' },
        { period: '7th Period', startTime: '10:28 AM', endTime: '11:08 AM', label: 'Class Period' },
        { period: '5th Period', startTime: '11:12 AM', endTime: '12:57 PM', label: 'Lunch / Class' },
        { period: '6th Period', startTime: '12:01 PM', endTime: '12:46 PM', label: 'Lunch / Class' },
        { period: '8th Period', startTime: '12:50 PM', endTime: '01:30 PM', label: 'Class Period' },
        { period: 'Activity Period', startTime: '02:05 PM', endTime: '02:37 PM', label: 'Activity Period' }
      ];
    case 'normal':
    default:
      return [
        { period: 'Homeroom', startTime: '07:35 AM', endTime: '07:50 AM', label: 'Homeroom' },
        { period: '1st Period', startTime: '07:54 AM', endTime: '08:41 AM', label: 'Class Period' },
        { period: '2nd Period', startTime: '08:45 AM', endTime: '09:32 AM', label: 'Class Period' },
        { period: '3rd Period', startTime: '09:36 AM', endTime: '10:23 AM', label: 'Class Period' },
        { period: '4th Period', startTime: '10:27 AM', endTime: '11:15 AM', label: 'Class Period' },
        { period: '5th Period (Lunch)', startTime: '11:19 AM', endTime: '12:04 PM', label: '1st Lunch' },
        { period: '6th Period (2nd Lunch)', startTime: '12:08 PM', endTime: '12:53 PM', label: '2nd Lunch' },
        { period: '7th Period', startTime: '12:57 PM', endTime: '01:44 PM', label: 'Class Period' },
        { period: '8th Period', startTime: '01:48 PM', endTime: '02:37 PM', label: 'Class Period' }
      ];
  }
}

// MAINTENANCE MIDDLEWARE
app.use(async (req, res, next) => {
  if (
    req.path.startsWith('/api/login') ||
    req.path.startsWith('/api/register') ||
    req.path.startsWith('/api/admin') ||
    req.path === '/api/config/maintenance' ||
    !req.path.startsWith('/api/')
  ) {
    return next();
  }

  try {
    const maintenance = await SystemConfig.findOne({ key: 'maintenanceMode' });
    if (maintenance && maintenance.value && maintenance.value.active === true) {
      const userId = req.headers['x-user-id'];
      if (userId) {
        const user = await User.findById(userId);
        if (user && user.role === 'admin') return next();
      }
      return res.status(503).json({
        error: 'MAINTENANCE_LOCK',
        message: maintenance.value.message || 'System is undergoing scheduled maintenance.',
        estimatedTime: maintenance.value.estimatedTime || 'Soon'
      });
    }
  } catch (err) {
    console.error('Maintenance Middleware Error:', err);
  }
  next();
});

// PAGE ROUTING
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// AUTHENTICATION & USER MANAGEMENT
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'All fields required.' });

    const cleanUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

    const role = (cleanUsername === 'admin') ? 'admin' : 'student';
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username: cleanUsername, password: hashedPassword, name: name.trim(), role, badges: [] });

    res.status(201).json({ userId: newUser._id, name: newUser.name, role: newUser.role });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    res.json({ userId: user._id, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

app.post('/api/users/:id/avatar', async (req, res) => {
  const { avatarBg, avatarColor } = req.body;
  await User.findByIdAndUpdate(req.params.id, { avatarBg, avatarColor });
  res.json({ success: true });
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password verification.' });

    await User.findByIdAndDelete(req.params.id);
    await ChatChannel.updateMany({}, { $pull: { members: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// RECURRING DAY RULES API
app.get('/api/admin/day-rules', async (req, res) => {
  res.json(await DayRule.find().sort({ dayOfWeek: 1 }));
});

app.post('/api/admin/day-rules', async (req, res) => {
  const { dayOfWeek, preset } = req.body;
  const rule = await DayRule.findOneAndUpdate({ dayOfWeek }, { dayOfWeek, preset }, { upsert: true, new: true });
  res.json(rule);
});

app.delete('/api/admin/day-rules/:id', async (req, res) => {
  await DayRule.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post('/api/master-schedule/check-day-rules', async (req, res) => {
  const todayOfWeek = new Date().getDay();
  const rule = await DayRule.findOne({ dayOfWeek: todayOfWeek });

  if (rule) {
    await MasterSchedule.deleteMany({});
    const slots = await generatePresetSlots(rule.preset);
    await MasterSchedule.insertMany(slots);
    return res.json({ appliedRule: true, preset: rule.preset });
  }

  res.json({ appliedRule: false });
});

// COMMUNITY POLL ROUTES
app.get('/api/polls/active', async (req, res) => {
  const activePoll = await Poll.findOne({ active: true }).sort({ createdAt: -1 });
  res.json(activePoll);
});

app.post('/api/polls/:id/vote', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { optionIndex } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const poll = await Poll.findById(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });

  poll.options.forEach(opt => {
    opt.votes = opt.votes.filter(id => id !== userId);
  });

  if (poll.options[optionIndex]) {
    poll.options[optionIndex].votes.push(userId);
  }

  await poll.save();
  res.json(poll);
});

app.post('/api/admin/polls', async (req, res) => {
  const { question, options } = req.body;
  await Poll.updateMany({}, { active: false });

  const formattedOptions = options.map(optText => ({ text: optText, votes: [] }));
  const newPoll = await Poll.create({ question, options: formattedOptions, active: true });

  res.json(newPoll);
});

app.post('/api/admin/polls/:id/activate', async (req, res) => {
  await Poll.updateMany({}, { active: false });
  const activated = await Poll.findByIdAndUpdate(req.params.id, { active: true }, { new: true });
  res.json(activated);
});

app.get('/api/admin/polls', async (req, res) => {
  res.json(await Poll.find().sort({ createdAt: -1 }));
});

app.delete('/api/admin/polls/:id', async (req, res) => {
  await Poll.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// SUGGESTION & FEEDBACK ROUTES
app.get('/api/suggestions', async (req, res) => {
  res.json(await Suggestion.find().sort({ createdAt: -1 }));
});

app.post('/api/suggestions', async (req, res) => {
  const { title, description, authorName, authorId } = req.body;
  const suggestion = await Suggestion.create({ title, description, authorName, authorId });
  res.json(suggestion);
});

app.delete('/api/suggestions/:id', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const suggestion = await Suggestion.findById(req.params.id);
  
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

  const user = await User.findById(userId);
  if (suggestion.authorId !== userId && (!user || user.role !== 'admin')) {
    return res.status(403).json({ error: 'Unauthorized delete' });
  }

  await Suggestion.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/suggestions/:id/status', async (req, res) => {
  const { status } = req.body;
  const updated = await Suggestion.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(updated);
});

// ADMIN USER BADGE MANAGEMENT
app.post('/api/admin/users/:id/badges', async (req, res) => {
  const { badge } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { badges: badge } },
    { new: true }
  );
  res.json({ badges: user.badges });
});

app.delete('/api/admin/users/:id/badges', async (req, res) => {
  const { badge } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $pull: { badges: badge } },
    { new: true }
  );
  res.json({ badges: user.badges });
});

// CHAT & DIRECT MESSAGING ROUTES
app.post('/api/chat/dm', async (req, res) => {
  const { targetUserId } = req.body;
  const currentUserId = req.headers['x-user-id'];

  if (!targetUserId || !currentUserId) return res.status(400).json({ error: 'Missing parameters' });

  let channel = await ChatChannel.findOne({
    isGroup: false,
    members: { $all: [currentUserId, targetUserId], $size: 2 }
  });

  if (!channel) {
    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);
    channel = await ChatChannel.create({
      name: `${currentUser ? currentUser.name : 'User'} & ${targetUser ? targetUser.name : 'User'}`,
      isGroup: false,
      members: [currentUserId, targetUserId]
    });
  }

  res.json(channel);
});

app.get('/api/chat/channels/:userId', async (req, res) => {
  const userId = req.params.userId;
  const channels = await ChatChannel.find({ members: userId }).lean();

  for (let channel of channels) {
    const unreadCount = await ChatMessage.countDocuments({
      channelId: channel._id,
      senderId: { $ne: userId },
      readBy: { $ne: userId }
    });
    channel.unreadCount = unreadCount;
  }

  res.json(channels);
});

app.post('/api/chat/channels', async (req, res) => {
  const channel = await ChatChannel.create(req.body);
  res.json(channel);
});

app.post('/api/chat/channels/:id/leave', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const channel = await ChatChannel.findById(req.params.id);

  if (!channel) return res.status(404).json({ error: 'Channel not found.' });

  channel.members = channel.members.filter(m => m !== userId);

  if (channel.adminId === userId && channel.members.length > 0) {
    channel.adminId = channel.members[0];
  }

  await channel.save();
  res.json({ success: true });
});

app.post('/api/chat/channels/:id/reassign-admin', async (req, res) => {
  const currentAdminId = req.headers['x-user-id'];
  const { newAdminId } = req.body;

  const channel = await ChatChannel.findById(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  if (channel.adminId !== currentAdminId) return res.status(403).json({ error: 'Only group admin can reassign leadership.' });

  channel.adminId = newAdminId;
  await channel.save();
  res.json({ success: true, channel });
});

app.delete('/api/chat/channels/:id', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const channel = await ChatChannel.findById(req.params.id);

  if (!channel) return res.status(404).json({ error: 'Channel not found.' });

  const user = await User.findById(userId);
  if (channel.adminId !== userId && (!user || user.role !== 'admin')) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  await ChatChannel.findByIdAndDelete(req.params.id);
  await ChatMessage.deleteMany({ channelId: req.params.id });
  res.json({ success: true });
});

app.get('/api/chat/messages/:channelId', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const messages = await ChatMessage.find({ channelId: req.params.channelId }).sort({ createdAt: 1 });

  if (userId) {
    await ChatMessage.updateMany(
      { channelId: req.params.channelId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
  }

  res.json(messages);
});

app.post('/api/chat/messages', async (req, res) => {
  const { channelId, senderId, senderName, text, imageUrl } = req.body;
  const message = await ChatMessage.create({
    channelId,
    senderId,
    senderName,
    text,
    imageUrl,
    readBy: [senderId]
  });

  if (typingState[channelId]) {
    delete typingState[channelId][senderId];
  }

  res.json(message);
});

app.put('/api/chat/messages/:id', async (req, res) => {
  const { text, senderId } = req.body;
  const msg = await ChatMessage.findById(req.params.id);

  if (!msg) return res.status(404).json({ error: 'Message not found.' });
  if (msg.senderId !== senderId) return res.status(403).json({ error: 'Unauthorized edit.' });

  msg.text = text;
  msg.edited = true;
  await msg.save();
  res.json(msg);
});

app.delete('/api/chat/messages/:id', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const msg = await ChatMessage.findById(req.params.id);

  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  const channel = await ChatChannel.findById(msg.channelId);
  const user = await User.findById(userId);
  const isGroupAdmin = channel && channel.adminId === userId;
  const isSiteAdmin = user && user.role === 'admin';

  if (msg.senderId !== userId && !isGroupAdmin && !isSiteAdmin) {
    return res.status(403).json({ error: 'Unauthorized delete.' });
  }

  await ChatMessage.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post('/api/chat/typing', (req, res) => {
  const { channelId, userId, userName, isTyping } = req.body;
  if (!typingState[channelId]) typingState[channelId] = {};

  if (isTyping) {
    typingState[channelId][userId] = userName;
  } else {
    delete typingState[channelId][userId];
  }
  res.json({ success: true });
});

app.get('/api/chat/typing/:channelId', (req, res) => {
  const currentUserId = req.headers['x-user-id'];
  const channelTyping = typingState[req.params.channelId] || {};
  const activeTypers = Object.entries(channelTyping)
    .filter(([id]) => id !== currentUserId)
    .map(([, name]) => name);

  res.json({ typers: activeTypers });
});

// RESOURCES & ADMIN CONTROLS
app.get('/api/resources', async (req, res) => res.json(await ResourceLink.find()));

app.post('/api/admin/resources', async (req, res) => {
  const link = await ResourceLink.create(req.body);
  res.json(link);
});

app.delete('/api/admin/resources/:id', async (req, res) => {
  await ResourceLink.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  res.json(user);
});

app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
  res.json({ success: true });
});

app.post('/api/admin/master-schedule/preset', async (req, res) => {
  const { preset } = req.body;
  await MasterSchedule.deleteMany({});
  const slots = await generatePresetSlots(preset);
  const created = await MasterSchedule.insertMany(slots);
  res.json(created);
});

// MAINTENANCE CONFIG
app.get('/api/config/maintenance', async (req, res) => {
  const maintenance = await SystemConfig.findOne({ key: 'maintenanceMode' });
  res.json(maintenance ? maintenance.value : { active: false, message: '', estimatedTime: '' });
});

app.post('/api/admin/maintenance', async (req, res) => {
  const { active, message, estimatedTime } = req.body;
  const config = await SystemConfig.findOneAndUpdate(
    { key: 'maintenanceMode' },
    { key: 'maintenanceMode', value: { active, message, estimatedTime } },
    { upsert: true, new: true }
  );
  res.json({ success: true, maintenance: config.value });
});

// CALENDAR & MASTER SCHEDULE
app.get('/api/calendar', async (req, res) => res.json(await CalendarEvent.find()));
app.get('/api/master-schedule', async (req, res) => res.json(await MasterSchedule.find()));

app.post('/api/admin/calendar', async (req, res) => {
  const event = await CalendarEvent.findOneAndUpdate({ date: req.body.date }, req.body, { upsert: true, new: true });
  res.json(event);
});

app.post('/api/users/:id/update-profile', async (req, res) => {
  try {
    const { name, newUsername, pfpUrl, chatBgColor, chatBubbleColor } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let updates = {};

    if (name) updates.name = name.trim();
    if (pfpUrl !== undefined) updates.pfpUrl = pfpUrl;
    if (chatBgColor) updates.chatBgColor = chatBgColor;
    if (chatBubbleColor) updates.chatBubbleColor = chatBubbleColor;

    // Handle 7-Day Username Rule
    if (newUsername && newUsername.toLowerCase() !== user.username) {
      const cleanNewUsername = newUsername.trim().toLowerCase();
      
      const now = new Date();
      if (user.lastUsernameChange) {
        const daysPassed = (now - new Date(user.lastUsernameChange)) / (1000 * 60 * 60 * 24);
        if (daysPassed < 7) {
          const daysLeft = Math.ceil(7 - daysPassed);
          return res.status(400).json({ 
            error: `You can only change your username once every 7 days. Try again in ${daysLeft} day(s).` 
          });
        }
      }

      const existing = await User.findOne({ username: cleanNewUsername });
      if (existing) return res.status(400).json({ error: 'Username already taken.' });

      updates.username = cleanNewUsername;
      updates.lastUsernameChange = now;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

app.delete('/api/admin/calendar/:date', async (req, res) => {
  await CalendarEvent.deleteOne({ date: req.params.date });
  res.json({ success: true });
});

app.post('/api/admin/master-schedule', async (req, res) => {
  const slot = await MasterSchedule.create(req.body);
  res.json(slot);
});

app.delete('/api/admin/master-schedule/:id', async (req, res) => {
  await MasterSchedule.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/users', async (req, res) => res.json(await User.find({}, '-password')));
app.delete('/api/admin/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Urbana High Server listening on port ${PORT}`));
