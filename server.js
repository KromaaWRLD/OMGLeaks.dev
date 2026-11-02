const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static assets (html, css, js files) from root directory
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || 'admin123';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas (coldwinters)'))
  .catch((err) => console.error('MongoDB Atlas Connection Error:', err));

// Database Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'student' },
  schedule: [{ period: String, className: String, room: String, teacher: String }]
});

const User = mongoose.model('User', UserSchema);

// Serve HTML pages directly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication Endpoints
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name, adminKey } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: 'All fields are required.' });

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

    let role = 'student';
    if (adminKey && adminKey === ADMIN_SECRET) role = 'admin';

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username: username.toLowerCase(), password: hashedPassword, name, role, schedule: [] });

    res.json({ userId: newUser._id, name: newUser.name, role: newUser.role });
  } catch (err) {
    res.status(500).json({ error: 'Database error registering account.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password.' });

    res.json({ userId: user._id, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Database error signing in.' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error loading user data.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));
