import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Appointment from '../models/Appointment.js';
import Queue from '../models/Queue.js';
import Patient from '../models/Patient.js';

const router = express.Router();

// Get all appointments
router.get('/', verifyToken, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId', 'firstName lastName patientNo forceNo patientType')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    
    const data = appointments.map(a => ({
      id: a._id,
      patientId: a.patientId?._id,
      patientName: a.patientId ? `${a.patientId.firstName} ${a.patientId.lastName}` : 'Unknown',
      mrNo: a.patientId?.patientNo,
      patientType: a.patientId?.patientType,
      doctorId: a.doctorId?._id,
      doctor: a.doctorId?.name,
      department: a.doctorId?.department,
      appointmentNo: a.appointmentNo,
      roomNo: a.roomNo,
      date: a.date,
      time: a.time,
      status: a.status,
      reason: a.reason,
      createdAt: a.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ [BACKEND] Error fetching appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get appointment by ID
router.get('/:appointmentId', verifyToken, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('patientId', 'firstName lastName patientNo forceNo patientType')
      .populate('doctorId', 'name department');
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: appointment._id,
        ...appointment.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get appointments for a patient
router.get('/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.params.patientId })
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    console.error('Error fetching patient appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get appointments for a doctor
router.get('/doctor/:doctorId', verifyToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctorId: req.params.doctorId })
      .populate('patientId', 'firstName lastName patientNo forceNo patientType')
      .sort({ createdAt: -1 });
    
    // Transform data for better frontend consumption
    const transformedAppointments = appointments.map(apt => ({
      id: apt._id,
      appointmentNo: apt.appointmentNo,
      patientId: apt.patientId?._id,
      patientName: apt.patientId ? `${apt.patientId.firstName} ${apt.patientId.lastName}` : 'Unknown',
      patientNo: apt.patientId?.patientNo,
      patientType: apt.patientId?.patientType,
      forceNo: apt.patientId?.forceNo,
      roomNo: apt.roomNo,
      date: apt.date,
      time: apt.time,
      status: apt.status,
      reason: apt.reason,
      createdAt: apt.createdAt,
      // Also include raw patientId object for backward compatibility
      patientId: apt.patientId,
    }));
    
    res.json({ success: true, data: transformedAppointments });
  } catch (err) {
    console.error('Error fetching doctor appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create appointment
router.post('/', verifyToken, checkRole(['receptionist', 'doctor', 'admin']), async (req, res) => {
  try {
    const { patientId, doctorId, roomNo, date, time, reason } = req.body;
    
    console.log('📝 [BACKEND] Creating appointment with:', { patientId, doctorId, roomNo, date, time, reason });

    if (!patientId || !doctorId || !roomNo || !date || !time) {
      console.error('❌ [BACKEND] Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required fields (patientId, doctorId, roomNo, date, time)' });
    }

    const appointmentCount = await Appointment.countDocuments();
    const appointmentNo = `APT-${String(appointmentCount + 1).padStart(3, '0')}`;

    const newAppointment = new Appointment({
      patientId,
      doctorId,
      appointmentNo,
      roomNo,
      date,
      time,
      status: 'scheduled',
      reason,
    });

    await newAppointment.save();
    console.log('✅ [BACKEND] Appointment saved to database:', appointmentNo);

    // Add patient to queue for this room
    const patient = await Patient.findById(patientId);
    const doctor = await (await import('../models/User.js')).default.findById(doctorId);
    
    console.log('📋 [BACKEND] Patient:', patient?.firstName, patient?.lastName, '| Doctor:', doctor?.name);
    
    let queue = await Queue.findOne({ roomNo });
    if (!queue) {
      queue = new Queue({
        doctorId,
        roomNo,
        doctorName: doctor?.name,
        department: doctor?.department,
        status: 'active',
        patients: [],
      });
    }

    const tokenNo = `T-${roomNo}-${queue.patients.length + 1}`;
    queue.patients.push({
      appointmentId: newAppointment._id,
      tokenNo,
      patientNo: patient?.patientNo,
      patientName: `${patient?.firstName} ${patient?.lastName}`,
      forceNo: patient?.forceNo,
      patientId,
      status: 'waiting',
      position: queue.patients.length,
    });

    await queue.save();
    console.log('✅ [BACKEND] Patient added to queue for room:', roomNo);

    // Decrease doctor's available slots
    if (doctor) {
      const currentSlots = doctor.available_slots || 10;
      const newSlots = Math.max(0, currentSlots - 1);
      doctor.available_slots = newSlots;
      await doctor.save();
      console.log('🎫 [BACKEND] Doctor slots updated:', { 
        doctorName: doctor.name, 
        previousSlots: currentSlots, 
        currentSlots: newSlots 
      });
    }

    // Format the response to match the GET endpoint format
    const formattedAppointment = {
      id: newAppointment._id,
      patientId: patient?._id,
      patientName: `${patient?.firstName} ${patient?.lastName}`,
      mrNo: patient?.patientNo,
      patientType: patient?.patientType,
      doctorId: doctor?._id,
      doctor: doctor?.name,
      department: doctor?.department,
      appointmentNo: newAppointment.appointmentNo,
      roomNo: newAppointment.roomNo,
      date: newAppointment.date,
      time: newAppointment.time,
      status: newAppointment.status,
      reason: newAppointment.reason,
      createdAt: newAppointment.createdAt,
    };

    console.log('📤 [BACKEND] Sending formatted response:', formattedAppointment);

    res.status(201).json({ 
      success: true, 
      message: 'Appointment created and added to queue', 
      data: formattedAppointment
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error creating appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update appointment status
router.put('/:appointmentId', verifyToken, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const { status, time, date } = req.body;
    if (status) appointment.status = status;
    if (time) appointment.time = time;
    if (date) appointment.date = date;

    await appointment.save();
    res.json({ 
      success: true, 
      message: 'Appointment updated', 
      data: {
        id: appointment._id,
        ...appointment.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete appointment
router.delete('/:appointmentId', verifyToken, checkRole(['receptionist', 'admin']), async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear all appointments (for testing/reset)
router.delete('/admin/clear-all', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    console.log('🗑️ [BACKEND] Clearing all appointments...');
    
    const deleteResult = await Appointment.deleteMany({});
    const queueDeleteResult = await Queue.deleteMany({});
    
    console.log('✅ [BACKEND] Deleted', deleteResult.deletedCount, 'appointments and', queueDeleteResult.deletedCount, 'queue entries');
    
    res.json({ 
      success: true, 
      message: 'All appointments cleared',
      deletedAppointments: deleteResult.deletedCount,
      deletedQueues: queueDeleteResult.deletedCount
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error clearing appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
