const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://27johnballenger_db_user:iBZYg2Mdo4Xv7c19@winter.upuzovj.mongodb.net/coldwinters?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB (coldwinters)'))
  .catch((err) => console.error('MongoDB error:', err));

// Mongoose User Schema
const UserSchema = new mongoose.Schema({
  username: String,
  name: String,
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
});

const User = mongoose.model('User', UserSchema);

// LOGIN ROUTE
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  let user = await User.findOne({ username: username.toLowerCase() });

  // Auto-create Admin user if logging in with username "admin"
  if (!user && username.toLowerCase() === 'admin') {
    user = await User.create({
      username: 'admin',
      name: 'System Admin',
      role: 'admin',
      schedule: []
    });
  } else if (!user) {
    // Auto-create standard student user
    user = await User.create({
      username: username.toLowerCase(),
      name: username.replace('.', ' '),
      role: 'student',
      schedule: [
        { period: '1st', className: 'English IX', room: '102', teacher: 'Smith' },
        { period: '2nd', className: 'Algebra I', room: '204', teacher: 'Johnson' }
      ]
    });
  }

  res.json({ userId: user._id, name: user.name, role: user.role });
});

// GET USER DETAILS & SCHEDULE
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD CLASS TO SCHEDULE
app.post('/api/users/:id/schedule', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.schedule.push(req.body);
    await user.save();
    res.json(user.schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add class' });
  }
});

// DELETE CLASS FROM SCHEDULE
app.delete('/api/users/:id/schedule/:index', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.schedule.splice(req.params.index, 1);
    await user.save();
    res.json(user.schedule);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// ADMIN: GET ALL USERS
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username name role');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN: DELETE USER
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
