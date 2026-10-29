const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, './')));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Multer Disk Storage Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// SCHEMAS
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
    enum: ['JW3', 'LND', 'FD', 'OTHER'], 
    default: 'JW3' 
  },
  producers: { type: String, default: '' },
  engineers: { type: String, default: '' },
  recordingDate: { type: String, default: '' },
  studioLocation: { type: String, default: '' },
  notes: { type: String, default: '' },
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
  notifyUsers: { type: Boolean, default: false },
  author: { type: String, default: 'Cold Winters Team' },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);
const News = mongoose.model('News', newsSchema);

// AUTH
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user || (username === "admin" && password === "password123")) {
      return res.json({ success: true, token: "cw-editor-authenticated-session-9982" });
    }
    return res.status(401).json({ success: false, message: "Invalid username or password" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server auth error" });
  }
});

// FILE UPLOAD ENDPOINT (Handles direct audio/cover uploads)
app.post('/api/upload', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), (req, res) => {
  try {
    const audioPath = req.files['audio'] ? `/uploads/${req.files['audio'][0].filename}` : null;
    const coverPath = req.files['cover'] ? `/uploads/${req.files['cover'][0].filename}` : null;
    res.json({ success: true, audioUrl: audioPath, coverArt: coverPath });
  } catch (err) {
    res.status(500).json({ success: false, message: "File upload failed" });
  }
});

// SONGS API
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

// NEWS API
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

// FRONTEND ROUTES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/editor', (req, res) => res.sendFile(path.join(__dirname, 'editor.html')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cold Winters Full-Stack Site running on port ${PORT}`);
});
