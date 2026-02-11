// Script to reset a user's password
// Run with: node scripts/resetPassword.js <email> <newPassword>

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const resetPassword = async () => {
  const email = process.argv[2];
  const newPassword = process.argv[3] || 'password123';

  if (!email) {
    console.log('Usage: node scripts/resetPassword.js <email> [newPassword]');
    console.log('Example: node scripts/resetPassword.js doctor@smarthospital.com password123');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital');
    console.log('✓ Connected to MongoDB\n');

    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`✗ User not found with email: ${email}`);
      console.log('\nAvailable users:');
      const allUsers = await User.find().select('email role');
      allUsers.forEach(u => console.log(`   • ${u.email} (${u.role})`));
      process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.email}) - Role: ${user.role}`);
    
    // Set plaintext password - the pre-save hook will hash it
    user.password = newPassword;
    await user.save();
    
    console.log(`\n✓ Password reset successfully!`);
    console.log(`\n📋 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Role: ${user.role}`);
    console.log(`\n⚠️  Make sure to select "${user.role}" as the role on the login page!`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

resetPassword();
