import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    console.log(`[AUTH] Login attempt - Email: ${email}, Role: ${role}`);

    if (!email || !password || !role) {
      console.log('[AUTH] Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // First check if user exists with this email
    const userByEmail = await User.findOne({ email });
    if (!userByEmail) {
      console.log(`[AUTH] No user found with email: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if role matches
    if (userByEmail.role !== role) {
      console.log(`[AUTH] Role mismatch - User role: ${userByEmail.role}, Requested role: ${role}`);
      return res.status(401).json({ 
        success: false, 
        message: `Invalid credentials. This user is registered as "${userByEmail.role}", not "${role}".` 
      });
    }

    const user = userByEmail;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`[AUTH] Password valid: ${isPasswordValid}`);

    if (!isPasswordValid) {
      console.log('[AUTH] Invalid password');
      return res.status(401).json({ success: false, message: 'Invalid credentials - wrong password' });
    }

    const token = generateToken(user);
    const userData = { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      department: user.department 
    };

    console.log(`[AUTH] Login successful for: ${user.name} (${user.role})`);

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userData, token },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const newUser = new User({
      name,
      email,
      password,
      role,
      department: '',
      phone: '',
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
    });

    await newUser.save();

    const token = generateToken(newUser);
    const userData = { 
      id: newUser._id, 
      name: newUser.name, 
      email: newUser.email, 
      role: newUser.role 
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user: userData, token },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify Token
router.post('/verify-token', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production');
    res.json({ success: true, data: decoded });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
