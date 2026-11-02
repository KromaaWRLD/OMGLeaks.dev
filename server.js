const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB URI using your connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB (coldwinters)'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Mongoose User Schema
const UserSchema = new mongoose.Schema({
  username: String,
  name: String,
  schoolName: { type: String, default: 'Urbana High School' },
  pendingFriends: Array,
  assignments: Array
});

const User = mongoose.model('User', UserSchema);

// Auth Route
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  
  // Find user or auto-create demo user for testing
  let user = await User.findOne({ username });
  if (!user) {
    user = await User.create({
      username,
      name: username.replace('.', ' '),
      schoolName: 'Urbana High School',
      pendingFriends: ['friend_1'],
      assignments: [{ task: 'Chem Homework', completed: false, dueDate: new Date().toISOString().split('T')[0] }]
    });
  }

  res.json({ userId: user._id, name: user.name });
});

// Dynamic Nav Data Route
app.get('/api/users/:id/nav-summary', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().split('T')[0];
    const dueAssignments = (user.assignments || []).filter(a => !a.completed && a.dueDate === today).length;

    res.json({
      name: user.name,
      schoolName: 'Urbana High School',
      pendingRequests: (user.pendingFriends || []).length,
      dueAssignments: dueAssignments
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
