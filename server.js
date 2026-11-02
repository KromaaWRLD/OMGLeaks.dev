const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || 'admin123'; // Set your admin password here

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas (coldwinters)'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// --- SCHEMAS --- //

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'student' }, // 'student' or 'admin'
  schedule: [{ period: String, className: String, room: String, teacher: String }]
});

// System Calendar Schema (Days off & Holidays)
const CalendarEventSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  isDayOff: { type: Boolean, default: true },
  title: String
});

// Master Schedule Template Schema (Set by Admin)
const MasterScheduleSchema = new mongoose.Schema({
  period: String,
  startTime: String,
  endTime: String,
  label: String
});

const User = mongoose.model('User', UserSchema);
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);
const MasterSchedule = mongoose.model('MasterSchedule', MasterScheduleSchema);

// --- AUTH ROUTES --- //

// Register New Account
app.post('/api/register', async (req, res) => {
  const { username, password, name, adminKey } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const existingUser = await User.findOne({ username: username.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists.' });
  }

  let role = 'student';
  if (adminKey) {
    if (adminKey === ADMIN_SECRET) {
      role = 'admin';
    } else {
      return res.status(403).json({ error: 'Invalid Admin Security Password.' });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    username: username.toLowerCase(),
    password: hashedPassword,
    name,
    role,
    schedule: []
  });

  res.json({ userId: newUser._id, name: newUser.name, role: newUser.role });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) return res.status(400).json({ error: 'User not found.' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Invalid password.' });

  res.json({ userId: user._id, name: user.name, role: user.role });
});

// --- STUDENT USER ROUTES --- //

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/:id/schedule', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.schedule.push(req.body);
    await user.save();
    res.json(user.schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add class' });
  }
});

app.delete('/api/users/:id/schedule/:index', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.schedule.splice(req.params.index, 1);
    await user.save();
    res.json(user.schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// --- CALENDAR & SCHEDULE MASTER ROUTES --- //

app.get('/api/calendar', async (req, res) => {
  const events = await CalendarEvent.find();
  res.json(events);
});

app.get('/api/master-schedule', async (req, res) => {
  const master = await MasterSchedule.find().sort({ period: 1 });
  res.json(master);
});

// --- ADMIN CONTROL ROUTES --- //

// Create Day Off / Calendar Event
app.post('/api/admin/calendar', async (req, res) => {
  const { date, title, isDayOff } = req.body;
  try {
    const event = await CalendarEvent.findOneAndUpdate(
      { date },
      { date, title, isDayOff },
      { upsert: true, new: true }
    );
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update calendar.' });
  }
});

app.delete('/api/admin/calendar/:date', async (req, res) => {
  await CalendarEvent.deleteOne({ date: req.params.date });
  res.json({ success: true });
});

// Master Schedule Slot Builder
app.post('/api/admin/master-schedule', async (req, res) => {
  const { period, startTime, endTime, label } = req.body;
  try {
    const slot = await MasterSchedule.create({ period, startTime, endTime, label });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add master slot' });
  }
});

app.delete('/api/admin/master-schedule/:id', async (req, res) => {
  await MasterSchedule.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/users', async (req, res) => {
  const users = await User.find({}, '-password');
  res.json(users);
});

app.delete('/api/admin/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Urbana High Server running on port ${PORT}`));
