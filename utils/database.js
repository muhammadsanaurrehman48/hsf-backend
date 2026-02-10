import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePasswords = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateId = () => uuidv4();

// In-memory data stores (replace with database later)
export const users = [
  {
    id: generateId(),
    name: 'Dr. Ahmad Khan',
    email: 'ahmad@smarthospital.com',
    password: '$2a$10$YqA1HvjKHKzKRxH.5wL8tu.x/tB.4YNE8CIZ.gYKZJR6Zj8QG8n1u', // password: 'password123'
    role: 'doctor',
    department: 'Cardiology',
    phone: '0300-1234567',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    id: generateId(),
    name: 'Reception Staff',
    email: 'reception@smarthospital.com',
    password: '$2a$10$YqA1HvjKHKzKRxH.5wL8tu.x/tB.4YNE8CIZ.gYKZJR6Zj8QG8n1u', // password: 'password123'
    role: 'receptionist',
    department: 'Reception',
    phone: '0301-2345678',
    avatar: 'https://i.pravatar.cc/150?img=2',
  },
  {
    id: generateId(),
    name: 'Admin User',
    email: 'admin@smarthospital.com',
    password: '$2a$10$YqA1HvjKHKzKRxH.5wL8tu.x/tB.4YNE8CIZ.gYKZJR6Zj8QG8n1u', // password: 'password123'
    role: 'admin',
    department: 'Administration',
    phone: '0302-3456789',
    avatar: 'https://i.pravatar.cc/150?img=3',
  },
  {
    id: generateId(),
    name: 'Admin',
    email: 'admin@gmail.com',
    password: '$2a$10$ZA4xeoOxD38kcaA0/c.SOe8RwDvhXVixTKSDmUhJZ12EriF1HwJPu', // password: 'admin123'
    role: 'admin',
    department: 'Administration',
    phone: '0300-0000000',
    avatar: 'https://i.pravatar.cc/150?img=4',
  },
];

export const patients = [
  {
    id: generateId(),
    forceNo: 'F-12345',
    mrNo: 'MR-001234',
    firstName: 'Muhammad',
    lastName: 'Ali',
    gender: 'Male',
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
    createdAt: new Date('2025-01-15'),
  },
  {
    id: generateId(),
    forceNo: 'F-12346',
    mrNo: 'MR-001235',
    firstName: 'Fatima',
    lastName: 'Begum',
    gender: 'Female',
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
    createdAt: new Date('2025-01-10'),
  },
];

export const appointments = [
  {
    id: generateId(),
    patientId: patients[0].id,
    doctorId: users[0].id,
    appointmentNo: 'APT-001',
    date: '2025-02-08',
    time: '10:00',
    status: 'scheduled',
    reason: 'Follow-up consultation',
    createdAt: new Date(),
  },
];

export const prescriptions = [
  {
    id: generateId(),
    rxNo: 'RX-456789',
    patientId: patients[0].id,
    mrNo: 'MR-001234',
    forceNo: 'F-12345',
    doctorId: users[0].id,
    diagnosis: 'Essential Hypertension',
    medicines: [
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: '30 days', instructions: 'Take in the morning' },
      { name: 'Atorvastatin', dosage: '10mg', frequency: 'Once daily at night', duration: '30 days', instructions: 'Take after dinner' },
    ],
    labTests: ['Complete Blood Count', 'Lipid Profile'],
    radiologyTests: [],
    notes: 'Low salt diet recommended',
    status: 'completed',
    createdAt: new Date('2025-02-01'),
  },
];

export const labRequests = [
  {
    id: generateId(),
    requestNo: 'LAB-2025-0123',
    patientId: patients[0].id,
    mrNo: 'MR-001234',
    forceNo: 'F-12345',
    test: 'Complete Blood Count',
    doctorId: users[0].id,
    requestDate: new Date('2025-02-01'),
    status: 'pending',
    result: null,
  },
];

export const radiologyRequests = [
  {
    id: generateId(),
    requestNo: 'RAD-2025-0001',
    patientId: patients[0].id,
    mrNo: 'MR-001234',
    forceNo: 'F-12345',
    testType: 'X-Ray',
    doctorId: users[0].id,
    requestDate: new Date('2025-02-01'),
    status: 'pending',
    report: null,
  },
];

export const invoices = [
  {
    id: generateId(),
    invoiceNo: 'INV-2025-001',
    patientId: patients[0].id,
    mrNo: 'MR-001234',
    patientName: 'Muhammad Ali',
    items: [
      { service: 'Consultation Fee', price: 1500, quantity: 1 },
      { service: 'Blood Test', price: 800, quantity: 1 },
    ],
    total: 2300,
    discount: 0,
    netAmount: 2300,
    paymentStatus: 'pending',
    createdAt: new Date('2025-02-01'),
  },
];

export const departments = [
  { id: generateId(), name: 'General Medicine', description: 'General medical services' },
  { id: generateId(), name: 'Cardiology', description: 'Heart and cardiovascular diseases' },
  { id: generateId(), name: 'Orthopedics', description: 'Bone and joint services' },
  { id: generateId(), name: 'Laboratory', description: 'Laboratory services' },
  { id: generateId(), name: 'Radiology', description: 'Imaging services' },
  { id: generateId(), name: 'Pharmacy', description: 'Pharmacy services' },
  { id: generateId(), name: 'Nursing', description: 'Nursing care' },
];

export const activities = [
  { id: generateId(), title: 'New user registered', description: 'Dr. Ahmed Khan joined as Doctor', time: '5 min ago', status: 'completed' },
  { id: generateId(), title: 'System backup completed', description: 'Daily backup successful', time: '1 hour ago', status: 'completed' },
  { id: generateId(), title: 'New department added', description: 'Cardiology department created', time: '2 hours ago', status: 'completed' },
];
