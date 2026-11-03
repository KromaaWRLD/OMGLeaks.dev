const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Body Parser Middleware with Increased Payload Limit for Image Uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve Static Files from Root Directory
app.use(express.static(path.join(__dirname)));

// Payload Size Error Handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Uploaded file/image is too large. Please select a smaller file.' });
  }
  next();
});

// Environment Configurations
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

// Connect to MongoDB Atlas (Deprecated Options Removed for Compatibility)
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
  avatarColor: { type: String, default: '#000000' }
}, { timestamps: true });

const SystemConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', UserSchema);
const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

// MAINTENANCE MODE MIDDLEWARE (Uses standard 503 HTTP status)
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
        if (user && user.role === 'admin') return next(); // Bypass for Admin accounts
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
