const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ Connected to MongoDB Atlas (coldwinters)'))
.catch((err) => console.error('❌ MongoDB Connection Error:', err));

// SCHEMAS
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'student' },
  avatarBg: { type: String, default: '#ffffff' },
  avatarColor: { type: String, default: '#000000' }
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
  createdAt: { type: Date, default: Date.now }
});

const ResourceLinkSchema = new mongoose.Schema({
  title: String,
  url: String,
  icon: String
});

const SystemConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', UserSchema);
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);
const MasterSchedule = mongoose.model('MasterSchedule', MasterScheduleSchema);
const ChatChannel = mongoose.model('ChatChannel', ChatChannelSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const ResourceLink = mongoose.model('ResourceLink', ResourceLinkSchema);
const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

const typingState = {};

// server.js - Maintenance Middleware Fix
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
        if (user && user.role === 'admin') return next(); // Bypass for Admins
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
// STATIC ROUTES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// AUTH & USER ROUTES
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'All fields required.' });

    const cleanUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

    const role = (cleanUsername === 'admin') ? 'admin' : 'student';
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username: cleanUsername, password: hashedPassword, name: name.trim(), role });

    res.status(201).json({ userId: newUser._id, name: newUser.name, role: newUser.role });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
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
  const user = await User.findById(req.params.id, '-password');
  res.json(user);
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

// DIRECT MESSAGING & CHAT CHANNELS
app.post('/api/chat/dm', async (req, res) => {
  const { targetUserId } = req.body;
  const currentUserId = req.headers['x-user-id'];

  if (!targetUserId || !currentUserId) return res.status(400).json({ error: 'Missing parameters' });

  // Check if DM channel already exists between these two users
  let channel = await ChatChannel.findOne({
    isGroup: false,
    members: { $all: [currentUserId, targetUserId],$size: 2 }
  });

  if (!channel) {
    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);
    channel = await ChatChannel.create({
      name: `${currentUser.name} & ${targetUser.name}`,
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

// LEAVE GROUP CHAT
app.post('/api/chat/channels/:id/leave', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const channel = await ChatChannel.findById(req.params.id);

  if (!channel) return res.status(404).json({ error: 'Channel not found.' });

  channel.members = channel.members.filter(m => m !== userId);

  // If the admin leaves, assign next member as admin
  if (channel.adminId === userId && channel.members.length > 0) {
    channel.adminId = channel.members[0];
  }

  await channel.save();
  res.json({ success: true });
});

// GROUP ADMIN REASSIGNMENT
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
  
  // Allow group admin or site admin to delete
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

// LINKS & RESOURCES MANAGER
app.get('/api/resources', async (req, res) => {
  const links = await ResourceLink.find();
  res.json(links);
});

app.post('/api/admin/resources', async (req, res) => {
  const link = await ResourceLink.create(req.body);
  res.json(link);
});

app.delete('/api/admin/resources/:id', async (req, res) => {
  await ResourceLink.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ADMIN OVERRIDES: ROLE & PASSWORD
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

// SCHEDULE PRESET SWITCHER
app.post('/api/admin/master-schedule/preset', async (req, res) => {
  const { preset } = req.body;
  await MasterSchedule.deleteMany({});

  let slots = [];
  if (preset === 'normal') {
    slots = [
      { period: '1st', startTime: '08:00 AM', endTime: '08:50 AM', label: 'Standard Class' },
      { period: '2nd', startTime: '08:55 AM', endTime: '09:45 AM', label: 'Standard Class' },
      { period: '3rd', startTime: '09:50 AM', endTime: '10:40 AM', label: 'Standard Class' },
      { period: '4th', startTime: '10:45 AM', endTime: '11:35 AM', label: 'Standard Class' },
      { period: 'Lunch', startTime: '11:40 AM', endTime: '12:15 PM', label: 'Lunch Period' },
      { period: '5th', startTime: '12:20 PM', endTime: '01:10 PM', label: 'Standard Class' },
      { period: '6th', startTime: '01:15 PM', endTime: '02:05 PM', label: 'Standard Class' },
      { period: '7th', startTime: '02:10 PM', endTime: '03:00 PM', label: 'Standard Class' }
    ];
  } else if (preset === 'delay2hr') {
    slots = [
      { period: '1st', startTime: '10:00 AM', endTime: '10:35 AM', label: '2-Hr Delay Period' },
      { period: '2nd', startTime: '10:40 AM', endTime: '11:15 AM', label: '2-Hr Delay Period' },
      { period: 'Lunch', startTime: '11:20 AM', endTime: '11:55 AM', label: 'Lunch Period' },
      { period: '3rd', startTime: '12:00 PM', endTime: '12:35 PM', label: '2-Hr Delay Period' },
      { period: '4th', startTime: '12:40 PM', endTime: '01:15 PM', label: '2-Hr Delay Period' },
      { period: '5th', startTime: '01:20 PM', endTime: '01:50 PM', label: '2-Hr Delay Period' },
      { period: '6th', startTime: '01:55 PM', endTime: '02:25 PM', label: '2-Hr Delay Period' },
      { period: '7th', startTime: '02:30 PM', endTime: '03:00 PM', label: '2-Hr Delay Period' }
    ];
  } else if (preset === 'assembly') {
    slots = [
      { period: '1st', startTime: '08:00 AM', endTime: '08:40 AM', label: 'Assembly Schedule' },
      { period: '2nd', startTime: '08:45 AM', endTime: '09:25 AM', label: 'Assembly Schedule' },
      { period: 'Assembly', startTime: '09:30 AM', endTime: '10:30 AM', label: 'Pep Rally / Assembly' },
      { period: '3rd', startTime: '10:35 AM', endTime: '11:15 AM', label: 'Assembly Schedule' },
      { period: 'Lunch', startTime: '11:20 AM', endTime: '11:55 AM', label: 'Lunch Period' },
      { period: '4th', startTime: '12:00 PM', endTime: '12:40 PM', label: 'Assembly Schedule' },
      { period: '5th', startTime: '12:45 PM', endTime: '01:25 PM', label: 'Assembly Schedule' },
      { period: '6th', startTime: '01:30 PM', endTime: '02:10 PM', label: 'Assembly Schedule' },
      { period: '7th', startTime: '02:15 PM', endTime: '03:00 PM', label: 'Assembly Schedule' }
    ];
  }

  const created = await MasterSchedule.insertMany(slots);
  res.json(created);
});

// MAINTENANCE MODE API
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

// CALENDAR & MASTER SCHEDULE ROUTES
app.get('/api/calendar', async (req, res) => res.json(await CalendarEvent.find()));
app.get('/api/master-schedule', async (req, res) => res.json(await MasterSchedule.find()));

app.post('/api/admin/calendar', async (req, res) => {
  const event = await CalendarEvent.findOneAndUpdate({ date: req.body.date }, req.body, { upsert: true, new: true });
  res.json(event);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Urbana High Server listening on port ${PORT}`));
