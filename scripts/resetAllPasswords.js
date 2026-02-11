// Script to reset ALL user passwords to a default
// Run with: node scripts/resetAllPasswords.js [password]

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const resetAllPasswords = async () => {
  const newPassword = process.argv[2] || 'password123';

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital');
    console.log('✓ Connected to MongoDB\n');

    const users = await User.find();
    
    console.log(`Resetting passwords for ${users.length} users to: ${newPassword}\n`);

    for (const user of users) {
      // Set plaintext password - the pre-save hook will hash it
      user.password = newPassword;
      await user.save();
      console.log(`   ✓ ${user.email} (${user.role})`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ All passwords reset successfully!');
    console.log('='.repeat(60));
    console.log(`\nDefault password for all users: ${newPassword}`);
    console.log('\nUsers can now login with:');
    console.log('   Email: [their email]');
    console.log(`   Password: ${newPassword}`);
    console.log('   Role: [select correct role from dropdown]');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

resetAllPasswords();
