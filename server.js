const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static frontend files from the current folder
app.use(express.static(path.join(__dirname, './')));

// MongoDB Atlas Connection String
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// -----------------------------------------------------------------------------
// SCHEMAS & MODELS
// -----------------------------------------------------------------------------

// Contributor / User Account Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  featuredArtists: { type: String, default: '' },
  era: { 
    type: String, 
    enum: ['OUT', 'LND', 'FD', 'JW3', 'OTHER'], 
    default: 'OTHER' 
  },
  coverArt: { type: String, required: true },
  audioUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const newsSchema = new mongoose.Schema({
  version: { type: String, required: true },
  title: { type: String, required: true },
  group: { type: String, default: 'Recent Updates' },
  summary: { type: String, required: true },
  changes: [String],
  author: { type: String, default: 'Cold Winters Team' },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);
const News = mongoose.model('News', newsSchema);

// -----------------------------------------------------------------------------
// AUTHENTICATION & CONTRIBUTOR MANAGEMENT
// -----------------------------------------------------------------------------

// Login Route (Checks MongoDB Users table, falls back to default admin)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user || (username === "admin" && password === "password123")) {
      res.json({ success: true, token: "cw-editor-authenticated-session-9982" });
    } else {
      res.status(401).json({ success: false, message: "Invalid username or password" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Authentication error" });
  }
});

// Route to manually register new contributors
app.post('/api/users/create', async (req, res) => {
  try {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json({ success: true, message: `Contributor ${username} created!` });
  } catch (err) {
    res.status(400).json({ success: false, message: "Username already exists or invalid data" });
  }
});

// -----------------------------------------------------------------------------
// SONGS API
// -----------------------------------------------------------------------------

app.get('/api/songs', async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch songs" });
  }
});

app.post('/api/songs', async (req, res) => {
  try {
    const song = new Song(req.body);
    await song.save();
    res.status(201).json(song);
  } catch (err) {
    res.status(400).json({ error: "Failed to save song", details: err.message });
  }
});

app.delete('/api/songs/:id', async (req, res) => {
  try {
    await Song.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete song" });
  }
});

// -----------------------------------------------------------------------------
// NEWS API
// -----------------------------------------------------------------------------

app.get('/api/news', async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.post('/api/news', async (req, res) => {
  try {
    const newsItem = new News(req.body);
    await newsItem.save();
    res.status(201).json(newsItem);
  } catch (err) {
    res.status(400).json({ error: "Failed to save news post", details: err.message });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete news post" });
  }
});

// -----------------------------------------------------------------------------
// FRONTEND PAGE ROUTING
// -----------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'editor.html'));
});

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cold Winters Full-Stack Site running on port ${PORT}`);
});
