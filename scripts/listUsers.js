// Script to verify and list all users with their roles
// Run with: node scripts/listUsers.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const listUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital');
    console.log('✓ Connected to MongoDB\n');

    const users = await User.find().select('name email role department');
    
    console.log('='.repeat(80));
    console.log('ALL USERS IN DATABASE');
    console.log('='.repeat(80));
    console.log('');
    
    // Group by role
    const byRole = {};
    users.forEach(user => {
      if (!byRole[user.role]) byRole[user.role] = [];
      byRole[user.role].push(user);
    });

    Object.keys(byRole).sort().forEach(role => {
      console.log(`\n📋 ${role.toUpperCase()} (${byRole[role].length} users)`);
      console.log('-'.repeat(60));
      byRole[role].forEach(user => {
        console.log(`   • ${user.name} | ${user.email}`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Total: ${users.length} users`);
    console.log('='.repeat(80));
    
    console.log('\n💡 LOGIN TIP: Make sure the role you select matches the user\'s role in the database!');
    console.log('   Example: If user is "doctor", select "Doctor" on the login page.\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

listUsers();
