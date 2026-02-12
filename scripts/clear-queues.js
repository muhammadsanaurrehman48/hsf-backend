import mongoose from 'mongoose';
import Queue from '../models/Queue.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearQueues() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/SmartHospital';
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const result = await Queue.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} queue documents`);

    const remaining = await Queue.countDocuments();
    console.log(`📊 Queues remaining: ${remaining}`);
    
    if (remaining === 0) {
      console.log('✅ All queues cleared successfully!');
      console.log('✅ System is now refreshed for manual testing.');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing queues:', err.message);
    process.exit(1);
  }
}

clearQueues();
