const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ Connected to MongoDB Atlas (coldwinters)'))
.catch((err) => console.error('❌ MongoDB Connection Error:', err));

// --- MONGOOSE SCHEMAS --- //

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'student' },
  avatarBg: { type: String, default: '#ffffff' },
  avatarColor: { type: String, default: '#000000' },
  schedule: [{ period: String, className: String, room: String, teacher: String }]
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
  members: [String] // Array of User IDs
});

const ChatMessageSchema = new mongoose.Schema({
  channelId: String,
  senderId: String,
  senderName: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const AnnouncementSchema = new mongoose.Schema({
  text: String
});

const User = mongoose.model('User', UserSchema);
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);
const MasterSchedule = mongoose.model('MasterSchedule', MasterScheduleSchema);
const ChatChannel = mongoose.model('ChatChannel', ChatChannelSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);

// --- STATIC PAGE ROUTES --- //

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- AUTHENTICATION ROUTES --- //

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'All fields required.' });

    const cleanUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

    const role = (cleanUsername === 'admin') ? 'admin' : 'student';
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username: cleanUsername, password: hashedPassword, name: name.trim(), role, schedule: [] });

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

// --- USER & AVATAR PFP ROUTES --- //

app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id, '-password');
  res.json(user);
});

app.post('/api/users/:id/avatar', async (req, res) => {
  const { avatarBg, avatarColor } = req.body;
  await User.findByIdAndUpdate(req.params.id, { avatarBg, avatarColor });
  res.json({ success: true });
});

app.post('/api/users/:id/schedule', async (req, res) => {
  const user = await User.findById(req.params.id);
  user.schedule.push(req.body);
  await user.save();
  res.json(user.schedule);
});

app.delete('/api/users/:id/schedule/:index', async (req, res) => {
  const user = await User.findById(req.params.id);
  user.schedule.splice(req.params.index, 1);
  await user.save();
  res.json(user.schedule);
});

// --- STUDENT CHAT & GROUP ROUTES --- //

app.get('/api/chat/channels/:userId', async (req, res) => {
  const channels = await ChatChannel.find({ members: req.params.userId });
  res.json(channels);
});

app.post('/api/chat/channels', async (req, res) => {
  const channel = await ChatChannel.create(req.body);
  res.json(channel);
});

app.get('/api/chat/messages/:channelId', async (req, res) => {
  const messages = await ChatMessage.find({ channelId: req.params.channelId }).sort({ createdAt: 1 });
  res.json(messages);
});

app.post('/api/chat/messages', async (req, res) => {
  const message = await ChatMessage.create(req.body);
  res.json(message);
});

// --- CALENDAR & MASTER SCHEDULE ROUTES --- //

app.get('/api/calendar', async (req, res) => res.json(await CalendarEvent.find()));
app.get('/api/master-schedule', async (req, res) => res.json(await MasterSchedule.find()));

app.get('/api/announcement', async (req, res) => {
  const banner = await Announcement.findOne();
  res.json(banner || {});
});

// --- ADMIN ROUTES --- //

app.post('/api/admin/announcement', async (req, res) => {
  await Announcement.deleteMany({});
  const banner = await Announcement.create({ text: req.body.text });
  res.json(banner);
});

app.delete('/api/admin/announcement', async (req, res) => {
  await Announcement.deleteMany({});
  res.json({ success: true });
});

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
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Urbana High Server running on port ${PORT}`));
