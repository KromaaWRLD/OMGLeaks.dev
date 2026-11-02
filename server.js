const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Environment Variables & Configurations
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

// Connect to MongoDB Atlas
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
  role: { type: String, default: 'student' }, // 'student' or 'admin'
  schoolName: { type: String, default: 'Urbana High School' },
  schedule: [
    {
      period: String,
      className: String,
      room: String,
      teacher: String
    }
  ]
}, { timestamps: true });

const CalendarEventSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  isDayOff: { type: Boolean, default: true },
  title: String
});

const MasterScheduleSchema = new mongoose.Schema({
  period: String,
  startTime: String,
  endTime: String,
  label: String
});

const User = mongoose.model('User', UserSchema);
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);
const MasterSchedule = mongoose.model('MasterSchedule', MasterScheduleSchema);

// --- STATIC PAGE ROUTES --- //

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- AUTHENTICATION ROUTES --- //

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Full name, username, and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(400).json({ error: 'That username is already taken. Please pick another or log in.' });
    }

    // Assign 'admin' role automatically IF username is 'admin'
    const role = (cleanUsername === 'admin') ? 'admin' : 'student';

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: cleanUsername,
      password: hashedPassword,
      name: name.trim(),
      role,
      schedule: []
    });

    res.status(201).json({
      userId: newUser._id,
      name: newUser.name,
      role: newUser.role
    });

  } catch (err) {
    console.error('SERVER SIGNUP ERROR:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Please enter both username and password.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res.status(400).json({ error: 'Account not found. Please register first!' });
    }

    if (!user.password) {
      return res.status(400).json({ error: 'Account data corrupted. Please re-register.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password.' });
    }

    res.json({
      userId: user._id,
      name: user.name,
      role: user.role
    });

  } catch (err) {
    console.error('SERVER LOGIN ERROR:', err);
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
});

// --- STUDENT SCHEDULE ROUTES --- //

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error loading user data.' });
  }
});

app.post('/api/users/:id/schedule', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.schedule.push(req.body);
    await user.save();
    res.json(user.schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add class.' });
  }
});

app.delete('/api/users/:id/schedule/:index', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.schedule.splice(req.params.index, 1);
    await user.save();
    res.json(user.schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class.' });
  }
});

// --- CALENDAR & MASTER SCHEDULE ROUTES --- //

app.get('/api/calendar', async (req, res) => {
  try {
    const events = await CalendarEvent.find();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch calendar.' });
  }
});

app.get('/api/master-schedule', async (req, res) => {
  try {
    const master = await MasterSchedule.find();
    res.json(master);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch master schedule.' });
  }
});

// --- ADMIN CONTROL ROUTES --- //

app.post('/api/admin/calendar', async (req, res) => {
  const { date, title, isDayOff } = req.body;
  try {
    const event = await CalendarEvent.findOneAndUpdate(
      { date },
      { date, title, isDayOff: isDayOff === 'true' || isDayOff === true },
      { upsert: true, new: true }
    );
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update calendar.' });
  }
});

app.delete('/api/admin/calendar/:date', async (req, res) => {
  try {
    await CalendarEvent.deleteOne({ date: req.params.date });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete calendar date.' });
  }
});

app.post('/api/admin/master-schedule', async (req, res) => {
  const { period, startTime, endTime, label } = req.body;
  try {
    const slot = await MasterSchedule.create({ period, startTime, endTime, label });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bell slot.' });
  }
});

app.delete('/api/admin/master-schedule/:id', async (req, res) => {
  try {
    await MasterSchedule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete master slot.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Urbana High Server listening on port ${PORT}`);
});
