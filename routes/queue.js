import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Queue from '../models/Queue.js';
import Appointment from '../models/Appointment.js';

const router = express.Router();

// Get queue data for a specific room
router.get('/room/:roomNo', async (req, res) => {
  try {
    const roomNo = req.params.roomNo;
    console.log('\n🔍 [QUEUE] Fetching queue for room:', roomNo);
    
    const queue = await Queue.findOne({ roomNo })
      .populate('doctorId', 'name department')
      .populate('patients.patientId', 'firstName lastName patientNo');

    if (!queue) {
      console.log('⚠️ [QUEUE] No queue found for room:', roomNo);
      return res.status(404).json({ success: false, message: 'Queue not found for this room' });
    }

    console.log('📊 [QUEUE] Queue found. Doctor:', queue.doctorName);
    console.log('📋 [QUEUE] Total patients in queue:', queue.patients.length);
    console.log('⏳ [QUEUE] Waiting patients:', queue.patients.filter(p => p.status === 'waiting').length);

    // Find current serving patient - ensure it has serving status
    let currentPatient = queue.patients[queue.currentPatientIndex];
    if (currentPatient && currentPatient.status !== 'serving' && currentPatient.status !== 'completed') {
      console.log('⚠️ [QUEUE] Updating current patient status to serving:', currentPatient.patientName);
      currentPatient.status = 'serving';
      await queue.save();
    }

    // Re-fetch after potential save to get fresh data
    if (currentPatient && currentPatient.status === 'serving') {
      currentPatient = queue.patients[queue.currentPatientIndex];
    }

    const responseData = {
      id: queue._id,
      roomNo: queue.roomNo,
      doctorName: queue.doctorName,
      departmentId: queue.departmentId,
      department: queue.department,
      status: queue.status,
      currentToken: queue.currentToken,
      currentPatient: currentPatient && currentPatient.status !== 'completed' ? currentPatient.toObject ? currentPatient.toObject() : currentPatient : null,
      currentPatientIndex: queue.currentPatientIndex,
      totalPatients: queue.patients.length,
      waitingPatients: queue.patients.filter(p => p.status === 'waiting').length,
      patients: queue.patients.map((p, index) => ({
        ...p.toObject ? p.toObject() : p,
        position: index + 1,
      })),
    };

    console.log('✅ [QUEUE] Returning queue data:');
    console.log('   Room:', responseData.roomNo);
    console.log('   Doctor:', responseData.doctorName);
    console.log('   Current Serving:', responseData.currentPatient?.patientName);
    console.log('   Waiting Count:', responseData.waitingPatients);
    console.log('   Total Count:', responseData.totalPatients);
    console.log('   All Patients:', responseData.patients.map(p => ({
      token: p.tokenNo,
      name: p.patientName,
      status: p.status,
    })));

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('❌ [QUEUE] Error fetching queue:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all active queues
router.get('/', async (req, res) => {
  try {
    const queues = await Queue.find({ status: 'active' })
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });

    const data = queues.map(q => ({
      id: q._id,
      roomNo: q.roomNo,
      doctorName: q.doctorName,
      department: q.department,
      status: q.status,
      currentToken: q.currentToken,
      totalPatients: q.patients.length,
      waitingPatients: q.patients.filter(p => p.status === 'waiting').length,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching queues:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Move to next patient in queue
router.post('/room/:roomNo/next-patient', verifyToken, async (req, res) => {
  try {
    const queue = await Queue.findOne({ roomNo: req.params.roomNo });

    if (!queue) {
      return res.status(404).json({ success: false, message: 'Queue not found' });
    }

    // Mark current patient as completed
    if (queue.currentPatientIndex < queue.patients.length) {
      queue.patients[queue.currentPatientIndex].status = 'completed';

      // Update appointment status
      const currentPatient = queue.patients[queue.currentPatientIndex];
      if (currentPatient.appointmentId) {
        await Appointment.findByIdAndUpdate(
          currentPatient.appointmentId,
          { status: 'completed' }
        );
      }
    }

    // Move to next patient
    queue.currentPatientIndex = Math.min(queue.currentPatientIndex + 1, queue.patients.length - 1);
    
    const nextPatient = queue.patients[queue.currentPatientIndex];
    if (nextPatient) {
      nextPatient.status = 'serving';
      queue.currentToken = nextPatient.tokenNo;
    }

    await queue.save();

    res.json({ 
      success: true, 
      message: 'Moved to next patient',
      data: {
        currentPatientIndex: queue.currentPatientIndex,
        currentToken: queue.currentToken,
        currentPatient: nextPatient || null,
      }
    });
  } catch (err) {
    console.error('Error moving to next patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Complete appointment and move queue forward
router.post('/room/:roomNo/complete-appointment/:appointmentId', verifyToken, async (req, res) => {
  try {
    const queue = await Queue.findOne({ roomNo: req.params.roomNo });
    
    if (!queue) {
      return res.status(404).json({ success: false, message: 'Queue not found' });
    }

    // Find and complete the appointment
    const patientIndex = queue.patients.findIndex(p => p.appointmentId?.toString() === req.params.appointmentId);
    
    if (patientIndex === -1) {
      return res.status(404).json({ success: false, message: 'Patient not found in queue' });
    }

    queue.patients[patientIndex].status = 'completed';

    // Update appointment
    await Appointment.findByIdAndUpdate(
      req.params.appointmentId,
      { status: 'completed' }
    );

    // Move to next waiting patient
    queue.currentPatientIndex = patientIndex;
    const nextWaitingIndex = queue.patients.findIndex(
      (p, idx) => idx > patientIndex && p.status === 'waiting'
    );

    if (nextWaitingIndex !== -1) {
      queue.patients[nextWaitingIndex].status = 'serving';
      queue.currentToken = queue.patients[nextWaitingIndex].tokenNo;
      queue.currentPatientIndex = nextWaitingIndex;
    }

    await queue.save();

    res.json({ 
      success: true, 
      message: 'Appointment completed, queue advanced',
      data: {
        currentPatientIndex: queue.currentPatientIndex,
        currentToken: queue.currentToken,
      }
    });
  } catch (err) {
    console.error('Error completing appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Skip patient in queue
router.post('/room/:roomNo/skip-patient/:patientIndex', verifyToken, async (req, res) => {
  try {
    const queue = await Queue.findOne({ roomNo: req.params.roomNo });
    
    if (!queue) {
      return res.status(404).json({ success: false, message: 'Queue not found' });
    }

    const index = parseInt(req.params.patientIndex);
    if (index < 0 || index >= queue.patients.length) {
      return res.status(400).json({ success: false, message: 'Invalid patient index' });
    }

    queue.patients[index].status = 'skipped';
    await queue.save();

    res.json({ success: true, message: 'Patient skipped' });
  } catch (err) {
    console.error('Error skipping patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update current token for a room/department
router.put('/:roomNo/current-token', verifyToken, async (req, res) => {
  try {
    const { tokenNo } = req.body;
    const queue = await Queue.findOne({ roomNo: req.params.roomNo });
    
    if (!queue) {
      return res.status(404).json({ success: false, message: 'Queue not found for this room' });
    }

    // Find patient with this token number
    const patientIndex = queue.patients.findIndex(p => p.tokenNo === tokenNo);
    
    if (patientIndex === -1) {
      return res.status(404).json({ success: false, message: `Token ${tokenNo} not found in queue` });
    }

    // Update all patient statuses - mark previous as completed, new as serving
    if (queue.currentPatientIndex !== -1 && queue.currentPatientIndex < queue.patients.length) {
      const currentPatient = queue.patients[queue.currentPatientIndex];
      if (currentPatient.status === 'serving') {
        currentPatient.status = 'completed';
        console.log('✅ [BACKEND] Marked', currentPatient.patientName, 'as completed');
      }
    }

    // Set new current patient
    queue.currentPatientIndex = patientIndex;
    queue.currentToken = tokenNo;
    queue.patients[patientIndex].status = 'serving';
    
    console.log('📢 [BACKEND] Current token updated to:', tokenNo, 'Patient:', queue.patients[patientIndex].patientName);

    await queue.save();

    res.json({ 
      success: true, 
      message: 'Current token updated',
      data: {
        currentToken: queue.currentToken,
        currentPatient: queue.patients[patientIndex],
      }
    });
  } catch (err) {
    console.error('Error updating current token:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
