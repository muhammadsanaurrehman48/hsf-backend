import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Get all users
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const userData = users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      phone: u.phone,
      avatar: u.avatar,
      roomNo: u.roomNo,
    }));
    res.json({ success: true, data: userData });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user by ID
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userData = { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      department: user.department, 
      phone: user.phone, 
      avatar: user.avatar,
      roomNo: user.roomNo,
    };
    res.json({ success: true, data: userData });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user profile
router.put('/profile/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { name, phone, department } = req.body;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department) user.department = department;

    await user.save();

    const userData = { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      department: user.department, 
      phone: user.phone 
    };
    res.json({ success: true, message: 'Profile updated', data: userData });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new user (admin only)
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { name, email, password, role, department, phone, roomNo } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (role === 'doctor' && !roomNo) {
      return res.status(400).json({ success: false, message: 'Room assignment is required for doctors' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const newUser = new User({
      name,
      email,
      password,
      role,
      department,
      phone,
      roomNo: role === 'doctor' ? roomNo : undefined,
    });

    await newUser.save();
    const userData = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
      phone: newUser.phone,
      roomNo: newUser.roomNo,
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userData,
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user (admin only)
router.put('/:userId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { name, email, role, department, phone, roomNo } = req.body;
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (department) user.department = department;
    if (phone) user.phone = phone;

    const effectiveRole = role || user.role;
    if (effectiveRole === 'doctor' && roomNo !== undefined) {
      user.roomNo = roomNo;
    } else if (role && role !== 'doctor') {
      user.roomNo = '';
    }

    await user.save();

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      roomNo: user.roomNo,
    };

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userData,
    });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/:userId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all doctors (accessible to all authenticated users)
router.get('/role/doctor', verifyToken, async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-password');
    const doctorData = doctors.map(d => ({
      id: d._id,
      _id: d._id,
      name: d.name,
      firstName: d.name?.split(' ')[0] || '',
      lastName: d.name?.split(' ').slice(1).join(' ') || '',
      email: d.email,
      role: d.role,
      department: d.department || 'OPD',
      phone: d.phone,
      avatar: d.avatar,
      slots: d.available_slots || 10,
      max_slots: d.max_slots || 10,
      roomNo: d.roomNo,
    }));
    res.json({ success: true, data: doctorData });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
