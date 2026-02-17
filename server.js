import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import patientRoutes from './routes/patients.js';
import prescriptionRoutes from './routes/prescriptions.js';
import appointmentRoutes from './routes/appointments.js';
import labRequestRoutes from './routes/labRequests.js';
import radiologyRoutes from './routes/radiology.js';
import pharmacyRoutes from './routes/pharmacy.js';
import nurseRoutes from './routes/nurse.js';
import billingRoutes from './routes/billing.js';
import inventoryRoutes from './routes/inventory.js';
import adminRoutes from './routes/admin.js';
import departmentRoutes from './routes/departments.js';
import queueRoutes from './routes/queue.js';
import vitalsRoutes from './routes/vitals.js';
import referralRoutes from './routes/referrals.js';
import notificationRoutes from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Parse allowed origins from environment variables
const allowedOrigins = (process.env.FRONTEND_URLS || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim());

console.log('🔐 [CORS] Allowed Origins:', allowedOrigins);

// Dynamic CORS - allow local network IPs
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow any localhost or local network IP (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    const localNetworkPattern = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
    if (localNetworkPattern.test(origin)) {
      console.log('🔐 [CORS] Allowing local network origin:', origin);
      return callback(null, true);
    }
    
    console.log('🚫 [CORS] Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
const connectDB = async () => {
  try {
    // For development, you can use a local MongoDB or remove this connection
    // Uncomment the line below to connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital');
    console.log('✓ MongoDB connected');
    
    // console.log('✓ Database connection setup (using in-memory data)');
  } catch (err) {
    console.error('✗ Database connection error:', err.message);
  }
};

connectDB().then(async () => {
  // Auto-cleanup: remove stale (non-today) patients from queues on server start
  try {
    const QueueModel = (await import('./models/Queue.js')).default;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const queues = await QueueModel.find({});
    let staleRemoved = 0;
    for (const queue of queues) {
      const originalCount = queue.patients.length;
      queue.patients = queue.patients.filter(p => {
        const created = p.createdAt ? new Date(p.createdAt) : null;
        return created && created >= todayStart;
      });
      const removed = originalCount - queue.patients.length;
      if (removed > 0) {
        staleRemoved += removed;
        // Reset current token index if patients were removed
        if (queue.patients.length === 0) {
          queue.currentToken = null;
          queue.currentPatientIndex = 0;
        }
        await queue.save();
      }
    }
    if (staleRemoved > 0) {
      console.log(`🧹 Auto-cleanup: removed ${staleRemoved} stale patient(s) from queues (previous days)`);
    } else {
      console.log('✓ Queues clean — no stale patients found');
    }
  } catch (cleanupErr) {
    console.error('⚠️ Queue auto-cleanup error (non-fatal):', cleanupErr.message);
  }
});

// Schedule midnight cleanup — clear queues automatically at 00:00
const scheduleMidnightReset = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 30, 0); // 00:00:30 to avoid edge cases
  const msUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(async () => {
    console.log('🕛 [AUTO] Midnight queue cleanup triggered');
    try {
      const QueueModel = (await import('./models/Queue.js')).default;
      const queues = await QueueModel.find({});
      let cleared = 0;
      for (const queue of queues) {
        if (queue.patients.length > 0) {
          cleared += queue.patients.length;
          queue.patients = [];
          queue.currentToken = null;
          queue.currentPatientIndex = 0;
          await queue.save();
        }
      }
      console.log(`🧹 [AUTO] Midnight reset: cleared ${cleared} patients from ${queues.length} queues`);
    } catch (err) {
      console.error('❌ [AUTO] Midnight cleanup error:', err.message);
    }
    // Schedule next midnight
    scheduleMidnightReset();
  }, msUntilMidnight);

  console.log(`⏰ Next automatic queue reset scheduled in ${Math.round(msUntilMidnight / 60000)} minutes`);
};
scheduleMidnightReset();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/lab-requests', labRequestRoutes);
app.use('/api/radiology', radiologyRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/nurse', nurseRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

const server = app.listen(PORT, HOST, () => {
  console.log(`\n╔════════════════════════════════════════════════════════╗`);
  console.log(`║  Smart Hospital Backend Server                         ║`);
  console.log(`║  Local:   http://localhost:${PORT}                     ║`);
  console.log(`║  Network: http://${HOST}:${PORT} (all interfaces)      ║`);
  console.log(`╚════════════════════════════════════════════════════════╝\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log(`\n⚠️  Please kill the process using port ${PORT} and try again:`);
    console.log(`   Windows: taskkill /F /IM node.exe`);
    process.exit(1);
  }
  throw err;
});

export default app;
