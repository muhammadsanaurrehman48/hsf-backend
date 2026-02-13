import bcrypt from 'bcryptjs';
import User from '../models/User.js';

/**
 * Seed test users into the database if they don't exist
 * This runs on server startup to ensure test accounts are available
 */
export async function seedTestUsers() {
  try {
    const testUsers = [
      {
        name: 'Nurse Ali',
        email: 'nurse@hospital.com',
        password: 'password123',
        role: 'nurse',
        department: 'General',
      },
      {
        name: 'Dr. Ahmed Khan',
        email: 'doctor@hospital.com',
        password: 'password123',
        role: 'doctor',
        department: 'Orthopedic Surgery',
      },
      {
        name: 'Lab Technician Hassan',
        email: 'lab@hospital.com',
        password: 'password123',
        role: 'laboratory',
        department: 'Laboratory',
      },
      {
        name: 'Radiologist Sara',
        email: 'radiologist@hospital.com',
        password: 'password123',
        role: 'radiologist',
        department: 'Radiology',
      },
      {
        name: 'Pharmacist Fatima',
        email: 'pharmacist@hospital.com',
        password: 'password123',
        role: 'pharmacy',
        department: 'Pharmacy',
      },
      {
        name: 'Receptionist Zainab',
        email: 'receptionist@hospital.com',
        password: 'password123',
        role: 'receptionist',
        department: 'Reception',
      },
      {
        name: 'Admin User',
        email: 'admin@hospital.com',
        password: 'password123',
        role: 'admin',
        department: 'Administration',
      },
    ];

    console.log('🌱 [SEED] Starting user seeding process...');

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ email: userData.email });

      if (!existingUser) {
        // Pass plain password - the pre-save hook in User model will hash it
        const newUser = new User({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          department: userData.department,
          phone: '0300-0000000',
          avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
          status: 'active',
          available_slots: 10,
          max_slots: 10,
        });

        await newUser.save();
        console.log(
          `✅ [SEED] Created user: ${userData.email} (${userData.role})`
        );
      } else {
        // Ensure password is up to date (in case user was created with different password)
        const isPwMatch = await bcrypt.compare(userData.password, existingUser.password);
        if (!isPwMatch) {
          // Set plain password - the pre-save hook will hash it automatically
          existingUser.password = userData.password;
          await existingUser.save();
          console.log(
            `🔄 [SEED] Updated password for: ${userData.email} (${userData.role})`
          );
        } else {
          console.log(
            `⏭️ [SEED] User already exists: ${userData.email} (${userData.role})`
          );
        }
      }
    }

    console.log('✅ [SEED] User seeding completed successfully!');
    console.log('🔑 [SEED] Default credentials for testing:');
    console.log('   Email: nurse@hospital.com | Password: password123 | Role: nurse');
    console.log('   Email: doctor@hospital.com | Password: password123 | Role: doctor');
    console.log('   Email: lab@hospital.com | Password: password123 | Role: laboratory');
    console.log('   Email: pharmacist@hospital.com | Password: password123 | Role: pharmacy');
    console.log('   Email: admin@hospital.com | Password: password123 | Role: admin');

    return { success: true, message: 'User seeding completed' };
  } catch (error) {
    console.error('❌ [SEED] Error seeding users:', error);
    return { success: false, error: error.message };
  }
}

export default seedTestUsers;
