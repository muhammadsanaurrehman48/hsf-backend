#!/usr/bin/env node

/**
 * Comprehensive Appointment & Slot Management Test Suite
 * Tests the complete workflow:
 * 1. Create appointment (slots decrease)
 * 2. View updated slots
 * 3. Mark appointment complete (slots restore)
 * 4. View restored slots
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';
let authToken = '';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}`),
};

async function request(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    log.error(`Request failed: ${error.message}`);
    return { status: 0, data: null };
  }
}

async function loginAsReceptionist() {
  log.section('Login as Receptionist');
  
  const { status, data } = await request('POST', '/auth/login', {
    email: 'receptionist@asf.com',
    password: 'password123',
  });

  if (status === 200 && data.token) {
    authToken = data.token;
    log.success(`Logged in as: ${data.user?.name || 'Receptionist'}`);
    return true;
  } else {
    log.error(`Login failed: ${data?.message || 'Unknown error'}`);
    return false;
  }
}

async function getDoctors() {
  log.section('Fetching Doctors List');
  
  const { status, data } = await request('GET', '/users/role/doctor');

  if (status === 200 && data.success) {
    log.success(`Loaded ${data.data.length} doctors`);
    
    // Show doctor slots
    data.data.forEach((doc) => {
      console.log(
        `  • ${doc.name} (${doc.department}): ${doc.slots}/${doc.max_slots} slots available`
      );
    });

    return data.data;
  } else {
    log.error(`Failed to fetch doctors: ${data?.message}`);
    return [];
  }
}

async function getPatients() {
  log.section('Fetching Patients List');
  
  const { status, data } = await request('GET', '/patients');

  if (status === 200 && data.success) {
    log.success(`Loaded ${data.data.length} patients`);
    return data.data.slice(0, 3); // Get first 3 patients
  } else {
    log.error(`Failed to fetch patients: ${data?.message}`);
    return [];
  }
}

async function createAppointment(patientId, doctorId, roomNo, doctorName) {
  log.section(`Creating Appointment - Patient with Dr. ${doctorName} in Room ${roomNo}`);
  
  const appointmentData = {
    patientId,
    doctorId,
    roomNo,
    date: new Date().toISOString().split('T')[0],
    reason: 'Test Consultation',
  };

  log.info(`Sending appointment data: ${JSON.stringify(appointmentData)}`);

  const { status, data } = await request('POST', '/appointments', appointmentData);

  if (status === 201 && data.success) {
    log.success(`Appointment created: ${data.data.appointmentNo}`);
    log.info(`Token generated: ${data.data.token}`);
    return data.data;
  } else {
    log.error(`Failed to create appointment: ${data?.message}`);
    log.warn(`Response: ${JSON.stringify(data)}`);
    return null;
  }
}

async function getDoctorAfterAppointment(doctorId) {
  log.section('Checking Doctor Slots After Appointment Creation');
  
  const { status, data } = await request('GET', `/users/role/doctor`);

  if (status === 200 && data.success) {
    const doctor = data.data.find((d) => d._id === doctorId || d.id === doctorId);
    if (doctor) {
      log.info(`Doctor: ${doctor.name}`);
      log.info(`Slots: ${doctor.slots}/${doctor.max_slots} (DECREASED by 1)`);
      return doctor;
    }
  } else {
    log.error(`Failed to fetch doctor info`);
  }
  return null;
}

async function updateAppointmentStatus(appointmentId, newStatus) {
  log.section(`Marking Appointment as ${newStatus.toUpperCase()}`);
  
  const { status, data } = await request('PUT', `/appointments/${appointmentId}`, {
    status: newStatus,
  });

  if (status === 200 && data.success) {
    log.success(`Appointment status updated to: ${newStatus}`);
    return true;
  } else {
    log.error(`Failed to update appointment: ${data?.message}`);
    return false;
  }
}

async function getDoctorAfterCompletion(doctorId) {
  log.section('Checking Doctor Slots After Completion');
  
  const { status, data } = await request('GET', `/users/role/doctor`);

  if (status === 200 && data.success) {
    const doctor = data.data.find((d) => d._id === doctorId || d.id === doctorId);
    if (doctor) {
      log.info(`Doctor: ${doctor.name}`);
      log.info(`Slots: ${doctor.slots}/${doctor.max_slots} (RESTORED by 1)`);
      return doctor;
    }
  } else {
    log.error(`Failed to fetch doctor info`);
  }
  return null;
}

async function runTests() {
  console.clear();
  console.log(`${colors.blue}
╔══════════════════════════════════════════════════════════════╗
║        DOCTOR SLOT MANAGEMENT - INTEGRATION TEST SUITE       ║
║                      Smart Hospital System                   ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // Step 1: Login
  const loggedIn = await loginAsReceptionist();
  if (!loggedIn) {
    log.error('Cannot continue without authentication');
    process.exit(1);
  }

  // Step 2: Get doctors
  const doctors = await getDoctors();
  if (doctors.length === 0) {
    log.error('No doctors found');
    process.exit(1);
  }

  // Step 3: Get patients
  const patients = await getPatients();
  if (patients.length === 0) {
    log.error('No patients found');
    process.exit(1);
  }

  // Select test data
  const testDoctor = doctors[0];
  const testPatient = patients[0];
  const testRoomNo = '101';
  const initialSlots = testDoctor.slots;

  log.info(`\nTest Configuration:`);
  log.info(`  • Doctor: ${testDoctor.name} (Initial Slots: ${initialSlots}/${testDoctor.max_slots})`);
  log.info(`  • Patient: ${testPatient.name}`);
  log.info(`  • Room: ${testRoomNo}`);

  // Step 4: Create appointment and check slot decrease
  const appointment = await createAppointment(
    testPatient._id || testPatient.id,
    testDoctor._id || testDoctor.id,
    testRoomNo,
    testDoctor.name
  );

  if (!appointment) {
    log.error('Test failed: Could not create appointment');
    process.exit(1);
  }

  // Step 5: Verify slot decreased
  const doctorAfterCreate = await getDoctorAfterAppointment(
    testDoctor._id || testDoctor.id
  );

  if (doctorAfterCreate && doctorAfterCreate.slots === initialSlots - 1) {
    log.success(`✓ Slot management working: ${initialSlots} → ${doctorAfterCreate.slots}`);
  } else {
    log.warn(
      `Slot not updated as expected: expected ${initialSlots - 1}, got ${doctorAfterCreate?.slots}`
    );
  }

  // Step 6: Mark appointment as completed
  const updated = await updateAppointmentStatus(appointment.id || appointment._id, 'completed');
  if (!updated) {
    log.error('Failed to update appointment status');
    process.exit(1);
  }

  // Step 7: Verify slot restored
  const doctorAfterComplete = await getDoctorAfterCompletion(
    testDoctor._id || testDoctor.id
  );

  if (doctorAfterComplete && doctorAfterComplete.slots === initialSlots) {
    log.success(`✓ Slot restoration working: ${initialSlots - 1} → ${doctorAfterComplete.slots}`);
  } else {
    log.warn(
      `Slot not restored as expected: expected ${initialSlots}, got ${doctorAfterComplete?.slots}`
    );
  }

  // Summary
  console.log(`\n${colors.blue}══════════════════════════════════════════════════════════════${colors.reset}`);
  log.section('TEST SUMMARY');
  
  const slotDecreased = doctorAfterCreate && doctorAfterCreate.slots === initialSlots - 1;
  const slotRestored = doctorAfterComplete && doctorAfterComplete.slots === initialSlots;

  console.log(`
${slotDecreased ? colors.green + '✓' : colors.red + '✗'} Slot Decreased on Appointment Creation: ${initialSlots} → ${doctorAfterCreate?.slots}${colors.reset}
${slotRestored ? colors.green + '✓' : colors.red + '✗'} Slot Restored on Appointment Completion: ${doctorAfterComplete?.slots}${colors.reset}

${(() => {
  if (slotDecreased && slotRestored) {
    return `${colors.green}
  ✓✓✓ ALL TESTS PASSED ✓✓✓
  
  Doctor slot management is working perfectly!
  • Slots decrease when appointments are created
  • Slots increase when appointments are completed/cancelled${colors.reset}`;
  } else if (slotDecreased) {
    return `${colors.yellow}
  ⚠ PARTIAL SUCCESS
  • Slot decrease working ✓
  • Slot restoration needs review${colors.reset}`;
  } else {
    return `${colors.red}
  ✗✗✗ TEST FAILURES ✗✗✗
  
  Doctor slot management system is not working as expected.
  Please check backend logs for errors.${colors.reset}`;
  }
})()}

${colors.blue}══════════════════════════════════════════════════════════════${colors.reset}
  `);

  process.exit(slotDecreased && slotRestored ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  log.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
