const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Atlas Connection String (Uses Environment Variable with Fallback)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// -----------------------------------------------------------------------------
// MONGOOSE SCHEMAS & MODELS
// -----------------------------------------------------------------------------

// Song Document Schema
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

// News/Changelog Document Schema
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

const Song = mongoose.model('Song', songSchema);
const News = mongoose.model('News', newsSchema);

// -----------------------------------------------------------------------------
// AUTHENTICATION ROUTE
// -----------------------------------------------------------------------------

// Simple Hardcoded Admin Credentials for Editors
const AUTH_CREDENTIALS = {
  username: process.env.ADMIN_USER || "admin",
  password: process.env.ADMIN_PASS || "password123"
};

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
    res.json({ success: true, token: "cw-editor-authenticated-session-9982" });
  } else {
    res.status(401).json({ success: false, message: "Invalid username or password" });
  }
});

// -----------------------------------------------------------------------------
// SONG ROUTES
// -----------------------------------------------------------------------------

// Fetch All Songs (Sorted Latest First)
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch songs" });
  }
});

// Add New Song
app.post('/api/songs', async (req, res) => {
  try {
    const song = new Song(req.body);
    await song.save();
    res.status(201).json(song);
  } catch (err) {
    res.status(400).json({ error: "Failed to save song", details: err.message });
  }
});

// Delete Song by ID
app.delete('/api/songs/:id', async (req, res) => {
  try {
    await Song.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Song deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete song" });
  }
});

// -----------------------------------------------------------------------------
// NEWS / CHANGELOG ROUTES
// -----------------------------------------------------------------------------

// Fetch All News (Sorted Latest First)
app.get('/api/news', async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Publish New Changelog Post
app.post('/api/news', async (req, res) => {
  try {
    const newsItem = new News(req.body);
    await newsItem.save();
    res.status(201).json(newsItem);
  } catch (err) {
    res.status(400).json({ error: "Failed to save news post", details: err.message });
  }
});

// Delete News Post by ID
app.delete('/api/news/:id', async (req, res) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "News post deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete news post" });
  }
});

// Health check endpoint for Docker/Render
app.get('/health', (req, res) => res.send('OK'));

// -----------------------------------------------------------------------------
// SERVER STARTUP
// -----------------------------------------------------------------------------

// Render automatically passes process.env.PORT
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cold Winters API running on port ${PORT}`);
});
