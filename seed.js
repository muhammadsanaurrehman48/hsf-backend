import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Import all models
import User from './models/User.js';
import Patient from './models/Patient.js';
import Appointment from './models/Appointment.js';
import Prescription from './models/Prescription.js';
import LabRequest from './models/LabRequest.js';
import RadiologyRequest from './models/RadiologyRequest.js';
import Invoice from './models/Invoice.js';
import Department from './models/Department.js';
import Inventory from './models/Inventory.js';
import Activity from './models/Activity.js';
import WardPatient from './models/WardPatient.js';
import Queue from './models/Queue.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB connected');

    // Clear existing data
    console.log('\nClearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Appointment.deleteMany({}),
      Prescription.deleteMany({}),
      LabRequest.deleteMany({}),
      RadiologyRequest.deleteMany({}),
      Invoice.deleteMany({}),
      Department.deleteMany({}),
      Inventory.deleteMany({}),
      Activity.deleteMany({}),
      WardPatient.deleteMany({}),
      Queue.deleteMany({}),
    ]);
    console.log('✓ Existing data cleared');

    // Create Departments
    console.log('\nCreating departments...');
    const departments = await Department.insertMany([
      { name: 'General Medicine', description: 'General medical services' },
      { name: 'Cardiology', description: 'Heart and cardiovascular diseases' },
      { name: 'Orthopedics', description: 'Bone and joint services' },
      { name: 'Laboratory', description: 'Laboratory services' },
      { name: 'Radiology', description: 'Imaging services' },
      { name: 'Pharmacy', description: 'Pharmacy services' },
      { name: 'Nursing', description: 'Nursing care' },
      { name: 'Emergency', description: 'Emergency services' },
      { name: 'Pediatrics', description: 'Child healthcare' },
      { name: 'Gynecology', description: 'Women health services' },
    ]);
    console.log(`✓ Created ${departments.length} departments`);

    // Create Users
    console.log('\nCreating users...');
    const salt = await bcrypt.genSalt(10);
    
    const usersData = [
      {
        name: 'Admin',
        email: 'admin@gmail.com',
        password: await bcrypt.hash('admin123', salt),
        role: 'admin',
        department: 'Administration',
        phone: '0300-0000000',
        avatar: 'https://i.pravatar.cc/150?img=4',
      },
      {
        name: 'Admin User',
        email: 'admin@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'admin',
        department: 'Administration',
        phone: '0302-3456789',
        avatar: 'https://i.pravatar.cc/150?img=3',
      },
      {
        name: 'Dr. Ahmad Khan',
        email: 'ahmad@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'doctor',
        department: 'Cardiology',
        phone: '0300-1234567',
        avatar: 'https://i.pravatar.cc/150?img=1',
      },
      {
        name: 'Dr. Fatima Bibi',
        email: 'fatima.dr@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'doctor',
        department: 'General Medicine',
        phone: '0301-9876543',
        avatar: 'https://i.pravatar.cc/150?img=5',
      },
      {
        name: 'Dr. Usman Ali',
        email: 'usman@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'doctor',
        department: 'Orthopedics',
        phone: '0303-5555555',
        avatar: 'https://i.pravatar.cc/150?img=8',
      },
      {
        name: 'Reception Staff',
        email: 'reception@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'receptionist',
        department: 'Reception',
        phone: '0301-2345678',
        avatar: 'https://i.pravatar.cc/150?img=2',
      },
      {
        name: 'Nurse Ayesha',
        email: 'nurse@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'nurse',
        department: 'Nursing',
        phone: '0304-1111111',
        avatar: 'https://i.pravatar.cc/150?img=9',
      },
      {
        name: 'Pharmacist Bilal',
        email: 'pharmacist@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'pharmacist',
        department: 'Pharmacy',
        phone: '0305-2222222',
        avatar: 'https://i.pravatar.cc/150?img=11',
      },
      {
        name: 'Lab Tech Hassan',
        email: 'lab@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'lab_technician',
        department: 'Laboratory',
        phone: '0306-3333333',
        avatar: 'https://i.pravatar.cc/150?img=12',
      },
      {
        name: 'Radiologist Dr. Zara',
        email: 'radiology@smarthospital.com',
        password: await bcrypt.hash('password123', salt),
        role: 'radiologist',
        department: 'Radiology',
        phone: '0307-4444444',
        avatar: 'https://i.pravatar.cc/150?img=10',
      },
    ];

    const users = await User.insertMany(usersData);
    console.log(`✓ Created ${users.length} users`);

    const doctor1 = users.find(u => u.email === 'ahmad@smarthospital.com');
    const doctor2 = users.find(u => u.email === 'fatima.dr@smarthospital.com');

    // Create Patients
    console.log('\nCreating patients...');
    const patientsData = [
      {
        patientNo: 'PAT-001001',
        patientType: 'ASF',
        forceNo: 'F-12345',
        firstName: 'Muhammad',
        lastName: 'Ali',
        gender: 'male',
        dateOfBirth: '1978-05-15',
        bloodGroup: 'O+',
        cnic: '12345-6789012-3',
        phone: '0300-1234567',
        email: 'ali@email.com',
        address: 'House 123, Street 456',
        city: 'Karachi',
        emergencyContact: { name: 'Fatima Ali', phone: '0300-1111111', relation: 'Sister' },
        allergies: 'Penicillin',
        existingConditions: 'Hypertension, Diabetes',
      },
      {
        patientNo: 'PAT-001002',
        patientType: 'ASF_FAMILY',
        forceNo: 'F-12346',
        firstName: 'Fatima',
        lastName: 'Begum',
        gender: 'female',
        dateOfBirth: '1990-08-22',
        bloodGroup: 'A+',
        cnic: '12346-6789012-3',
        phone: '0301-2345678',
        email: 'fatima@email.com',
        address: 'Apartment 789, Building 234',
        city: 'Lahore',
        emergencyContact: { name: 'Ahmed Begum', phone: '0301-2222222', relation: 'Brother' },
        allergies: 'None',
        existingConditions: 'Asthma',
      },
      {
        patientNo: 'PAT-001003',
        patientType: 'CIVILIAN',
        firstName: 'Ahmed',
        lastName: 'Khan',
        gender: 'male',
        dateOfBirth: '1985-03-10',
        bloodGroup: 'B+',
        cnic: '12347-6789012-3',
        phone: '0302-3456789',
        email: 'ahmed.khan@email.com',
        address: 'House 456, Street 789',
        city: 'Islamabad',
        emergencyContact: { name: 'Sara Khan', phone: '0302-3333333', relation: 'Wife' },
        allergies: 'Sulfa drugs',
        existingConditions: 'None',
      },
      {
        patientNo: 'PAT-001004',
        patientType: 'CIVILIAN',
        firstName: 'Sara',
        lastName: 'Bibi',
        gender: 'female',
        dateOfBirth: '1995-12-01',
        bloodGroup: 'AB+',
        cnic: '12348-6789012-3',
        phone: '0303-4567890',
        email: 'sara@email.com',
        address: 'House 789, Street 012',
        city: 'Rawalpindi',
        emergencyContact: { name: 'Ali Bibi', phone: '0303-4444444', relation: 'Father' },
        allergies: 'None',
        existingConditions: 'Migraine',
      },
      {
        patientNo: 'PAT-001005',
        patientType: 'ASF',
        forceNo: 'F-12349',
        firstName: 'Usman',
        lastName: 'Ali',
        gender: 'male',
        dateOfBirth: '1970-07-25',
        bloodGroup: 'O-',
        cnic: '12349-6789012-3',
        phone: '0304-5678901',
        email: 'usman.ali@email.com',
        address: 'House 012, Street 345',
        city: 'Peshawar',
        emergencyContact: { name: 'Zainab Ali', phone: '0304-5555555', relation: 'Daughter' },
        allergies: 'Aspirin',
        existingConditions: 'Heart Disease, High BP',
      },
      {
        patientNo: 'PAT-001006',
        patientType: 'CIVILIAN',
        firstName: 'Zainab',
        lastName: 'Fatima',
        gender: 'female',
        dateOfBirth: '2000-02-14',
        bloodGroup: 'A-',
        cnic: '12350-6789012-3',
        phone: '0305-6789012',
        email: 'zainab@email.com',
        address: 'Apartment 123, Building 456',
        city: 'Multan',
        emergencyContact: { name: 'Hassan Fatima', phone: '0305-6666666', relation: 'Brother' },
        allergies: 'None',
        existingConditions: 'None',
      },
    ];

    const patients = await Patient.insertMany(patientsData);
    console.log(`✓ Created ${patients.length} patients`);

    // Create Appointments
    console.log('\nCreating appointments...');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const appointmentsData = [
      { patientId: patients[0]._id, doctorId: doctor1._id, appointmentNo: 'APT-001', roomNo: '101', date: today, time: '10:00', status: 'scheduled', reason: 'Follow-up consultation' },
      { patientId: patients[1]._id, doctorId: doctor2._id, appointmentNo: 'APT-002', roomNo: '102', date: today, time: '10:30', status: 'scheduled', reason: 'General checkup' },
      { patientId: patients[2]._id, doctorId: doctor1._id, appointmentNo: 'APT-003', roomNo: '101', date: today, time: '11:00', status: 'completed', reason: 'Cardiac evaluation' },
      { patientId: patients[3]._id, doctorId: doctor2._id, appointmentNo: 'APT-004', roomNo: '102', date: tomorrow, time: '09:00', status: 'scheduled', reason: 'Migraine treatment' },
      { patientId: patients[4]._id, doctorId: doctor1._id, appointmentNo: 'APT-005', roomNo: '101', date: tomorrow, time: '09:30', status: 'scheduled', reason: 'Heart checkup' },
      { patientId: patients[5]._id, doctorId: doctor2._id, appointmentNo: 'APT-006', roomNo: '102', date: tomorrow, time: '10:00', status: 'scheduled', reason: 'Routine checkup' },
    ];

    const appointments = await Appointment.insertMany(appointmentsData);
    console.log(`✓ Created ${appointments.length} appointments`);

    // Create Prescriptions
    console.log('\nCreating prescriptions...');
    const prescriptionsData = [
      {
        rxNo: 'RX-456789',
        patientId: patients[0]._id,
        patientNo: patients[0].patientNo,
        forceNo: patients[0].forceNo,
        doctorId: doctor1._id,
        diagnosis: 'Essential Hypertension',
        medicines: [
          { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: '30 days', instructions: 'Take in the morning' },
          { name: 'Atorvastatin', dosage: '10mg', frequency: 'Once daily at night', duration: '30 days', instructions: 'Take after dinner' },
        ],
        labTests: ['Complete Blood Count', 'Lipid Profile'],
        radiologyTests: [],
        notes: 'Low salt diet recommended',
        status: 'completed',
      },
      {
        rxNo: 'RX-456790',
        patientId: patients[1]._id,
        patientNo: patients[1].patientNo,
        forceNo: patients[1].forceNo,
        doctorId: doctor2._id,
        diagnosis: 'Bronchial Asthma',
        medicines: [
          { name: 'Salbutamol Inhaler', dosage: '100mcg', frequency: 'As needed', duration: '30 days', instructions: 'Use during breathing difficulty' },
          { name: 'Montelukast', dosage: '10mg', frequency: 'Once daily at night', duration: '30 days', instructions: 'Take before sleep' },
        ],
        labTests: ['Pulmonary Function Test'],
        radiologyTests: ['Chest X-Ray'],
        notes: 'Avoid dust and smoke',
        status: 'pending',
      },
      {
        rxNo: 'RX-456791',
        patientId: patients[2]._id,
        patientNo: patients[2].patientNo,
        doctorId: doctor1._id,
        diagnosis: 'Acute Gastritis',
        medicines: [
          { name: 'Omeprazole', dosage: '20mg', frequency: 'Twice daily', duration: '14 days', instructions: 'Take before meals' },
          { name: 'Domperidone', dosage: '10mg', frequency: 'Three times daily', duration: '7 days', instructions: 'Take before meals' },
        ],
        labTests: [],
        radiologyTests: [],
        notes: 'Avoid spicy food',
        status: 'dispensed',
      },
    ];

    const prescriptions = await Prescription.insertMany(prescriptionsData);
    console.log(`✓ Created ${prescriptions.length} prescriptions`);

    // Create Lab Requests
    console.log('\nCreating lab requests...');
    const labRequestsData = [
      { requestNo: 'LAB-2025-0001', patientId: patients[0]._id, patientNo: patients[0].patientNo, forceNo: patients[0].forceNo, test: 'Complete Blood Count', doctorId: doctor1._id, status: 'pending' },
      { requestNo: 'LAB-2025-0002', patientId: patients[0]._id, patientNo: patients[0].patientNo, forceNo: patients[0].forceNo, test: 'Lipid Profile', doctorId: doctor1._id, status: 'pending' },
      { requestNo: 'LAB-2025-0003', patientId: patients[1]._id, patientNo: patients[1].patientNo, forceNo: patients[1].forceNo, test: 'Pulmonary Function Test', doctorId: doctor2._id, status: 'completed', result: { fev1: '85%', fvc: '90%', ratio: '94%' } },
      { requestNo: 'LAB-2025-0004', patientId: patients[2]._id, patientNo: patients[2].patientNo, test: 'Blood Sugar Fasting', doctorId: doctor1._id, status: 'in-progress' },
      { requestNo: 'LAB-2025-0005', patientId: patients[4]._id, patientNo: patients[4].patientNo, forceNo: patients[4].forceNo, test: 'ECG', doctorId: doctor1._id, status: 'pending' },
    ];

    const labRequests = await LabRequest.insertMany(labRequestsData);
    console.log(`✓ Created ${labRequests.length} lab requests`);

    // Create Radiology Requests
    console.log('\nCreating radiology requests...');
    const radiologyRequestsData = [
      { requestNo: 'RAD-2025-0001', patientId: patients[0]._id, patientNo: patients[0].patientNo, forceNo: patients[0].forceNo, testType: 'X-Ray Chest', doctorId: doctor1._id, status: 'pending' },
      { requestNo: 'RAD-2025-0002', patientId: patients[1]._id, patientNo: patients[1].patientNo, forceNo: patients[1].forceNo, testType: 'Chest X-Ray', doctorId: doctor2._id, status: 'completed', report: { findings: 'Normal chest X-ray', conclusion: 'No abnormality detected' } },
      { requestNo: 'RAD-2025-0003', patientId: patients[4]._id, patientNo: patients[4].patientNo, forceNo: patients[4].forceNo, testType: 'CT Scan Heart', doctorId: doctor1._id, status: 'in-progress' },
    ];

    const radiologyRequests = await RadiologyRequest.insertMany(radiologyRequestsData);
    console.log(`✓ Created ${radiologyRequests.length} radiology requests`);

    // Create Invoices
    console.log('\nCreating invoices...');
    const invoicesData = [
      {
        invoiceNo: 'INV-2025-001',
        patientId: patients[0]._id,
        patientNo: patients[0].patientNo,
        patientType: patients[0].patientType,
        forceNo: patients[0].forceNo,
        patientName: `${patients[0].firstName} ${patients[0].lastName}`,
        items: [
          { service: 'Consultation Fee', price: 1500, quantity: 1 },
          { service: 'Blood Test (CBC)', price: 800, quantity: 1 },
          { service: 'Lipid Profile', price: 1200, quantity: 1 },
        ],
        total: 3500,
        discount: 0,
        netAmount: 3500,
        paymentStatus: patients[0].patientType !== 'CIVILIAN' ? 'auto-paid' : 'pending',
        autoPayment: patients[0].patientType !== 'CIVILIAN',
      },
      {
        invoiceNo: 'INV-2025-002',
        patientId: patients[1]._id,
        patientNo: patients[1].patientNo,
        patientType: patients[1].patientType,
        forceNo: patients[1].forceNo,
        patientName: `${patients[1].firstName} ${patients[1].lastName}`,
        items: [
          { service: 'Consultation Fee', price: 1500, quantity: 1 },
          { service: 'Chest X-Ray', price: 2000, quantity: 1 },
        ],
        total: 3500,
        discount: 500,
        netAmount: 3000,
        paymentStatus: patients[1].patientType !== 'CIVILIAN' ? 'auto-paid' : 'paid',
        autoPayment: patients[1].patientType !== 'CIVILIAN',
        paymentMethod: patients[1].patientType !== 'CIVILIAN' ? 'Government' : 'Cash',
      },
      {
        invoiceNo: 'INV-2025-003',
        patientId: patients[2]._id,
        patientNo: patients[2].patientNo,
        patientType: patients[2].patientType,
        patientName: `${patients[2].firstName} ${patients[2].lastName}`,
        items: [
          { service: 'Consultation Fee', price: 1500, quantity: 1 },
          { service: 'Medicines', price: 450, quantity: 1 },
        ],
        total: 1950,
        discount: 0,
        netAmount: 1950,
        paymentStatus: 'paid',
        autoPayment: false,
        paymentMethod: 'Card',
      },
    ];

    const invoices = await Invoice.insertMany(invoicesData);
    console.log(`✓ Created ${invoices.length} invoices`);

    // Create Inventory (General + Pharmacy)
    console.log('\nCreating inventory...');
    const inventoryData = [
      // General inventory
      { name: 'PPE Kits', quantity: 500, unit: 'pieces', minStock: 100, price: 500, category: 'general' },
      { name: 'Syringes (5ml)', quantity: 1000, unit: 'pieces', minStock: 200, price: 50, category: 'general' },
      { name: 'Dressing Pads', quantity: 300, unit: 'pieces', minStock: 50, price: 150, category: 'general' },
      { name: 'Surgical Gloves', quantity: 800, unit: 'pairs', minStock: 150, price: 25, category: 'general' },
      { name: 'Face Masks', quantity: 2000, unit: 'pieces', minStock: 500, price: 15, category: 'general' },
      { name: 'Bandages', quantity: 400, unit: 'rolls', minStock: 100, price: 75, category: 'general' },
      // Pharmacy inventory
      { name: 'Amlodipine', strength: '5mg', quantity: 500, unit: 'tablets', minStock: 100, price: 5, category: 'pharmacy' },
      { name: 'Atorvastatin', strength: '10mg', quantity: 400, unit: 'tablets', minStock: 80, price: 8, category: 'pharmacy' },
      { name: 'Aspirin', strength: '75mg', quantity: 600, unit: 'tablets', minStock: 120, price: 3, category: 'pharmacy' },
      { name: 'Omeprazole', strength: '20mg', quantity: 350, unit: 'capsules', minStock: 70, price: 10, category: 'pharmacy' },
      { name: 'Paracetamol', strength: '500mg', quantity: 1000, unit: 'tablets', minStock: 200, price: 2, category: 'pharmacy' },
      { name: 'Amoxicillin', strength: '500mg', quantity: 300, unit: 'capsules', minStock: 60, price: 15, category: 'pharmacy' },
      { name: 'Metformin', strength: '500mg', quantity: 450, unit: 'tablets', minStock: 90, price: 6, category: 'pharmacy' },
      { name: 'Salbutamol Inhaler', strength: '100mcg', quantity: 50, unit: 'inhalers', minStock: 10, price: 350, category: 'pharmacy' },
    ];

    const inventory = await Inventory.insertMany(inventoryData);
    console.log(`✓ Created ${inventory.length} inventory items`);

    // Create Activities
    console.log('\nCreating activities...');
    const activitiesData = [
      { title: 'New user registered', description: 'Dr. Ahmed Khan joined as Doctor', time: '5 min ago', status: 'completed' },
      { title: 'System backup completed', description: 'Daily backup successful', time: '1 hour ago', status: 'completed' },
      { title: 'New department added', description: 'Cardiology department created', time: '2 hours ago', status: 'completed' },
      { title: 'Patient registered', description: 'Muhammad Ali registered as new patient', time: '3 hours ago', status: 'completed' },
      { title: 'Appointment created', description: 'New appointment scheduled for today', time: '4 hours ago', status: 'completed' },
      { title: 'Invoice generated', description: 'INV-2025-001 created for Muhammad Ali', time: '5 hours ago', status: 'completed' },
    ];

    const activities = await Activity.insertMany(activitiesData);
    console.log(`✓ Created ${activities.length} activities`);

    // Create Ward Patients
    console.log('\nCreating ward patients...');
    const wardPatientsData = [
      { patientId: patients[3]._id, name: `${patients[3].firstName} ${patients[3].lastName}`, patientNo: patients[3].patientNo, ward: 'General Ward A', bed: 'A-12', admitDate: new Date(), doctor: doctor2.name, doctorId: doctor2._id, status: 'admitted' },
      { patientId: patients[4]._id, name: `${patients[4].firstName} ${patients[4].lastName}`, patientNo: patients[4].patientNo, ward: 'ICU', bed: 'ICU-3', admitDate: new Date(), doctor: doctor1.name, doctorId: doctor1._id, status: 'admitted' },
    ];

    const wardPatients = await WardPatient.insertMany(wardPatientsData);
    console.log(`✓ Created ${wardPatients.length} ward patients`);

    // Create Queue for Room 101 (Dr. Ahmad Khan)
    console.log('\nCreating queues...');
    const cardiacQueueRoom101Data = {
      doctorId: doctor1._id,
      doctorName: doctor1.name,
      department: 'Cardiology',
      roomNo: '101',
      currentToken: 'T-101-1',
      currentPatientIndex: 0,
      status: 'active',
      patients: [
        {
          appointmentId: undefined, // Will be set when appointments are created
          tokenNo: 'T-101-1',
          patientNo: patients[0].patientNo,
          patientName: `${patients[0].firstName} ${patients[0].lastName}`,
          forceNo: patients[0].forceNo,
          patientId: patients[0]._id,
          status: 'serving',
          position: 1,
        },
        {
          appointmentId: undefined,
          tokenNo: 'T-101-2',
          patientNo: patients[1].patientNo,
          patientName: `${patients[1].firstName} ${patients[1].lastName}`,
          forceNo: patients[1].forceNo,
          patientId: patients[1]._id,
          status: 'waiting',
          position: 2,
        },
        {
          appointmentId: undefined,
          tokenNo: 'T-101-3',
          patientNo: patients[2].patientNo,
          patientName: `${patients[2].firstName} ${patients[2].lastName}`,
          forceNo: patients[2].forceNo || '',
          patientId: patients[2]._id,
          status: 'waiting',
          position: 3,
        },
      ],
    };

    // Create Queue for Room 102 (Dr. Fatima Bibi)
    const medicinQueueRoom102Data = {
      doctorId: doctor2._id,
      doctorName: doctor2.name,
      department: 'General Medicine',
      roomNo: '102',
      currentToken: 'T-102-1',
      currentPatientIndex: 0,
      status: 'active',
      patients: [
        {
          appointmentId: undefined,
          tokenNo: 'T-102-1',
          patientNo: patients[3].patientNo,
          patientName: `${patients[3].firstName} ${patients[3].lastName}`,
          forceNo: patients[3].forceNo || '',
          patientId: patients[3]._id,
          status: 'serving',
          position: 1,
        },
        {
          appointmentId: undefined,
          tokenNo: 'T-102-2',
          patientNo: patients[4].patientNo,
          patientName: `${patients[4].firstName} ${patients[4].lastName}`,
          forceNo: patients[4].forceNo,
          patientId: patients[4]._id,
          status: 'waiting',
          position: 2,
        },
        {
          appointmentId: undefined,
          tokenNo: 'T-102-3',
          patientNo: patients[5].patientNo,
          patientName: `${patients[5].firstName} ${patients[5].lastName}`,
          forceNo: patients[5].forceNo || '',
          patientId: patients[5]._id,
          status: 'waiting',
          position: 3,
        },
      ],
    };

    await Queue.create([cardiacQueueRoom101Data, medicinQueueRoom102Data]);
    console.log('✓ Created queues (2 rooms)');

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  Database seeding completed successfully!                   ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Admin Login:                                               ║');
    console.log('║    Email: admin@gmail.com                                   ║');
    console.log('║    Password: admin123                                       ║');
    console.log('║    Role: admin                                              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Other Users (password: password123):                       ║');
    console.log('║    - ahmad@smarthospital.com (doctor)                       ║');
    console.log('║    - fatima.dr@smarthospital.com (doctor)                   ║');
    console.log('║    - reception@smarthospital.com (receptionist)             ║');
    console.log('║    - nurse@smarthospital.com (nurse)                        ║');
    console.log('║    - pharmacist@smarthospital.com (pharmacist)              ║');
    console.log('║    - lab@smarthospital.com (lab_technician)                 ║');
    console.log('║    - radiology@smarthospital.com (radiologist)              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    mongoose.connection.close();
  } catch (err) {
    console.error('✗ Error seeding database:', err);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
