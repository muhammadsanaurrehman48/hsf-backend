// Script to fix role mismatches in the database
// Run with: node scripts/fixRoles.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const roleMapping = {
  'lab_technician': 'laboratory',
  'pharmacist': 'pharmacy',
  // Add any other mappings if needed
};

const fixRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital');
    console.log('✓ Connected to MongoDB\n');

    console.log('Checking for role mismatches...\n');

    for (const [oldRole, newRole] of Object.entries(roleMapping)) {
      const users = await User.find({ role: oldRole });
      
      if (users.length > 0) {
        console.log(`Found ${users.length} user(s) with role "${oldRole}" → changing to "${newRole}"`);
        
        for (const user of users) {
          console.log(`   Updating: ${user.email}`);
          await User.updateOne({ _id: user._id }, { $set: { role: newRole } });
        }
      }
    }

    console.log('\n✓ Role fixes complete!\n');

    // Show updated user list
    const users = await User.find().select('name email role');
    
    console.log('Updated user roles:');
    console.log('-'.repeat(60));
    users.forEach(u => {
      console.log(`   ${u.email.padEnd(40)} → ${u.role}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

fixRoles();
