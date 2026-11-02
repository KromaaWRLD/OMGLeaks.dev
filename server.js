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

const SystemConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', UserSchema);
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);
const MasterSchedule = mongoose.model('MasterSchedule', MasterScheduleSchema);
const ChatChannel = mongoose.model('ChatChannel', ChatChannelSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

const typingState = {};

// MAINTENANCE MODE MIDDLEWARE
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || req.path.startsWith('/api/admin') || !req.path.startsWith('/api/')) {
    return next();
  }

  const maintenance = await SystemConfig.findOne({ key: 'maintenanceMode' });
  if (maintenance && maintenance.value === true) {
    const userId = req.headers['x-user-id'];
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.role === 'admin') return next();
    }
    return res.status(503).json({ error: 'System is currently under maintenance. Please check back soon!' });
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

// CHAT & MESSAGING ROUTES
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

// GROUP DELETION ENDPOINT
app.delete('/api/chat/channels/:id', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const channel = await ChatChannel.findById(req.params.id);

  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  if (channel.adminId !== userId) return res.status(403).json({ error: 'Only Group Admin can delete this group.' });

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
  const isGroupAdmin = channel && channel.adminId === userId;

  if (msg.senderId !== userId && !isGroupAdmin) {
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

// SYSTEM CONFIG & MAINTENANCE MODE
app.get('/api/config/maintenance', async (req, res) => {
  const maintenance = await SystemConfig.findOne({ key: 'maintenanceMode' });
  res.json({ maintenance: maintenance ? maintenance.value : false });
});

app.post('/api/admin/maintenance', async (req, res) => {
  const { maintenance } = req.body;
  await SystemConfig.findOneAndUpdate(
    { key: 'maintenanceMode' },
    { key: 'maintenanceMode', value: maintenance },
    { upsert: true, new: true }
  );
  res.json({ success: true, maintenance });
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
