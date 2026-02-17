import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Appointment from '../models/Appointment.js';
import Queue from '../models/Queue.js';
import Patient from '../models/Patient.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import { getDailyTokenNumber, generateOPDToken } from '../utils/tokenUtils.js';
import { getOPDCharge } from '../utils/pricing.js';
import { generateInvoiceNo } from '../utils/invoiceHelper.js';

const router = express.Router();

// Get all appointments
router.get('/', verifyToken, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patientId', 'firstName lastName patientNo forceNo patientType')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    
    // Fetch all queues to get tokens
    const queues = await Queue.find({});
    
    // Create a map of appointmentId to token for quick lookup
    const tokenMap = new Map();
    queues.forEach(queue => {
      (queue.patients || []).forEach(patient => {
        if (patient.appointmentId) {
          tokenMap.set(patient.appointmentId.toString(), patient.tokenNo);
        }
      });
    });
    
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
      token: tokenMap.get(a._id.toString()) || null, // Include token from queue
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
    
    console.log('📝 [BACKEND] Creating appointment with:', { patientId, doctorId, roomNo, date, time: time || 'auto', reason });

    // Validate required fields with detailed error logging
    const missingFields = [];
    if (!patientId) missingFields.push('patientId');
    if (!doctorId) missingFields.push('doctorId');
    if (!roomNo) missingFields.push('roomNo');
    if (!date) missingFields.push('date');
    
    if (missingFields.length > 0) {
      console.error('❌ [BACKEND] Missing required fields:', missingFields);
      console.error('📋 [BACKEND] Received data:', { patientId, doctorId, roomNo, date, time });
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    const appointmentCount = await Appointment.countDocuments();
    const appointmentNo = `APT-${String(appointmentCount + 1).padStart(3, '0')}`;
    
    // Auto-generate time if not provided
    const appointmentTime = time || new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const newAppointment = new Appointment({
      patientId,
      doctorId,
      appointmentNo,
      roomNo,
      date,
      time: appointmentTime,
      status: 'scheduled',
      reason,
    });

    await newAppointment.save();
    console.log('✅ [BACKEND] Appointment saved to database:', appointmentNo);

    // Add patient to queue for this room and generate OPD token with daily reset
    const patient = await Patient.findById(patientId);
    const doctor = await User.findById(doctorId);
    
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

    // Generate OPD token with daily auto-reset
    // Count only patients added TODAY (after midnight)
    const dailyTokenCounter = getDailyTokenNumber(queue.patients);
    const tokenNo = generateOPDToken(roomNo, dailyTokenCounter);
    
    console.log('🎫 [BACKEND] Daily token counter:', dailyTokenCounter, '| Token:', tokenNo);
    
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
    console.log('✅ [BACKEND] Patient added to queue for room:', roomNo, '| Token:', tokenNo);

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

    // Create notification for all nurses
    const nurses = await User.find({ role: 'nurse' });
    console.log('🔔 [BACKEND] Notifying', nurses.length, 'nurses about new appointment');
    
    for (const nurse of nurses) {
      await Notification.create({
        userId: nurse._id,
        type: 'appointment_created',
        title: 'New Patient Arrival',
        message: `Patient ${patient?.firstName} ${patient?.lastName} (MR: ${patient?.patientNo}) arrived for consultation with Dr. ${doctor?.name}. Please record vitals.`,
        relatedId: newAppointment._id,
        relatedType: 'appointment',
        actionUrl: `/nurse/vitals/${newAppointment._id}`,
      });
    }
    console.log('✅ [BACKEND] Notifications created for nurses');

    // Generate OPD fee invoice based on patient type
    let opdInvoice = null;
    try {
      const opdCharge = getOPDCharge(patient?.patientType);
      const patientName = `${patient?.firstName} ${patient?.lastName}`;

      const invoiceNo = await generateInvoiceNo();

      opdInvoice = new Invoice({
        invoiceNo,
        patientId: patient._id,
        patientNo: patient.patientNo,
        patientType: patient.patientType,
        forceNo: patient.forceNo,
        patientName,
        source: 'OPD',
        items: [{ service: 'OPD Consultation Fee', department: 'OPD', price: opdCharge, quantity: 1 }],
        total: opdCharge,
        discount: 0,
        netAmount: opdCharge,
        amountPaid: 0,
        paymentStatus: 'pending',
      });
      await opdInvoice.save();
      console.log('✅ [BACKEND] OPD Invoice created:', invoiceNo, '| Rs.', opdCharge, '| Type:', patient.patientType);

      // Notify receptionist about ALL OPD invoices (even free ones need processing)
      const receptionists = await User.find({ role: { $in: ['receptionist', 'billing'] } });
      for (const staff of receptionists) {
        await Notification.create({
          userId: staff._id,
          type: 'invoice_created',
          title: 'OPD Fee Invoice',
          message: opdCharge > 0
            ? `OPD token generated for ${patientName} (${patient.patientType}). Invoice ${invoiceNo} - Rs. ${opdCharge} - payment pending.`
            : `OPD token generated for ${patientName} (${patient.patientType}). Invoice ${invoiceNo} - Free OPD - needs processing.`,
          relatedId: opdInvoice._id,
          relatedType: 'invoice',
          actionUrl: '/receptionist/billing',
        });
      }
    } catch (invoiceErr) {
      console.error('⚠️ [BACKEND] Error creating OPD invoice:', invoiceErr);
    }

    // Format the response to match the GET endpoint format
    const formattedAppointment = {
      id: newAppointment._id,
      patientId: patient?._id,
      patientName: `${patient?.firstName} ${patient?.lastName}`,
      mrNo: patient?.patientNo,
      patientType: patient?.patientType,
      forceNo: patient?.forceNo,
      doctorId: doctor?._id,
      doctor: doctor?.name,
      department: doctor?.department,
      appointmentNo: newAppointment.appointmentNo,
      roomNo: newAppointment.roomNo,
      date: newAppointment.date,
      time: newAppointment.time,
      token: tokenNo,
      status: newAppointment.status,
      reason: newAppointment.reason,
      createdAt: newAppointment.createdAt,
      // Include invoice details so frontend can display them
      invoice: opdInvoice ? {
        invoiceNo: opdInvoice.invoiceNo,
        amount: opdInvoice.netAmount,
        paymentStatus: opdInvoice.paymentStatus,
        source: opdInvoice.source,
      } : null,
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
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('doctorId');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const { status, time, date } = req.body;
    const previousStatus = appointment.status;
    
    if (status) appointment.status = status;
    if (time) appointment.time = time;
    if (date) appointment.date = date;

    await appointment.save();
    console.log('📝 [BACKEND] Appointment status updated:', appointment.appointmentNo, '| From:', previousStatus, 'To:', status);

    // Handle slot restoration when appointment is completed or cancelled
    if (status && (status === 'completed' || status === 'cancelled' || status === 'no-show')) {
      if (appointment.doctorId) {
        const doctor = await User.findById(appointment.doctorId._id);
        if (doctor) {
          const previousSlots = doctor.available_slots || 0;
          const maxSlots = doctor.max_slots || 10;
          const restoredSlots = Math.min(maxSlots, previousSlots + 1);
          doctor.available_slots = restoredSlots;
          await doctor.save();
          console.log('🎫 [BACKEND] Slot restored:', {
            doctorName: doctor.name,
            previousSlots: previousSlots,
            currentSlots: restoredSlots,
            maxSlots: maxSlots
          });
        }
      }
    }

    // Sync update to queue - find and update the patient in queue
    if (status) {
      const queue = await Queue.findOne({ roomNo: appointment.roomNo });
      if (queue) {
        const patientInQueue = queue.patients.find(p => p.appointmentId?.toString() === appointment._id.toString());
        if (patientInQueue) {
          console.log('📋 [BACKEND] Syncing queue for appointment. Old status:', patientInQueue.status, '| New status:', status);
          // Map appointment status to queue status
          if (status === 'completed') {
            patientInQueue.status = 'completed';
          } else if (status === 'cancelled' || status === 'no-show') {
            patientInQueue.status = 'skipped';
          } else if (status === 'vitals_recorded') {
            patientInQueue.status = 'vitals_recorded';
          }
          await queue.save();
          console.log('✅ [BACKEND] Queue synced for appointment:', appointment.appointmentNo);
        }
      }
    }

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
    const appointmentId = req.params.appointmentId;
    console.log('🔍 [BACKEND] Deleting appointment:', appointmentId);
    
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.error('❌ [BACKEND] Appointment not found:', appointmentId);
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const roomNo = appointment.roomNo;
    const appointmentIdStr = appointment._id.toString();
    console.log('📍 [BACKEND] Appointment details - Room:', roomNo, '| AppointmentId:', appointmentIdStr);

    // Find and update queue BEFORE deleting the appointment
    const queue = await Queue.findOne({ roomNo });
    console.log('🔎 [BACKEND] Queue lookup for room:', roomNo, '| Found:', !!queue);
    
    if (queue) {
      console.log('📊 [BACKEND] Queue has', queue.patients.length, 'patients');
      
      // Find the patient by appointmentId
      const patientIndex = queue.patients.findIndex(p => {
        const pAppId = p.appointmentId?.toString();
        console.log('  ↳ Checking patient:', p.patientName, '| AppointmentId:', pAppId, '| Match:', pAppId === appointmentIdStr);
        return pAppId === appointmentIdStr;
      });

      console.log('🔎 [BACKEND] Patient index found:', patientIndex);

      if (patientIndex !== -1) {
        const removedPatient = queue.patients.splice(patientIndex, 1)[0];
        console.log('🗑️ [BACKEND] Removed', removedPatient.patientName, 'from queue for room:', roomNo);
        
        // If we removed the current patient (index 0), advance to next one
        if (patientIndex === 0 && queue.patients.length > 0) {
          const nextPatient = queue.patients[0]; // First patient becomes current
          if (nextPatient) {
            nextPatient.status = 'serving';
            queue.currentToken = nextPatient.tokenNo;
            queue.currentPatientIndex = 0;
            console.log('⏭️ [BACKEND] Auto-advanced to next patient:', nextPatient.patientName, '| Token:', nextPatient.tokenNo);
          }
        } else if (queue.patients.length === 0) {
          queue.currentToken = null;
          queue.currentPatientIndex = 0;
          console.log('🛑 [BACKEND] Queue is now empty');
        }
        
        await queue.save();
        console.log('✅ [BACKEND] Queue updated after appointment deletion | Patients remaining:', queue.patients.length);
      } else {
        console.warn('⚠️ [BACKEND] Patient with appointmentId', appointmentIdStr, 'not found in queue');
      }
    } else {
      console.warn('⚠️ [BACKEND] Queue not found for room:', roomNo);
    }

    // Restore doctor's slot before deleting
    const doctor = await User.findById(appointment.doctorId);
    if (doctor) {
      const previousSlots = doctor.available_slots || 0;
      const maxSlots = doctor.max_slots || 10;
      const restoredSlots = Math.min(maxSlots, previousSlots + 1);
      doctor.available_slots = restoredSlots;
      await doctor.save();
      console.log('🎫 [BACKEND] Slot restored on deletion:', {
        doctorName: doctor.name,
        previousSlots: previousSlots,
        currentSlots: restoredSlots,
        maxSlots: maxSlots
      });
    }

    // Now delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);
    console.log('✅ [BACKEND] Appointment deleted from database');

    res.json({ success: true, message: 'Appointment deleted', removedFromQueue: true });
  } catch (err) {
    console.error('❌ [BACKEND] Error deleting appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assign token to appointment (manual queue entry)
router.post('/:appointmentId/assign-token', verifyToken, checkRole(['receptionist', 'doctor', 'admin']), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate('patientId', 'firstName lastName patientNo forceNo')
      .populate('doctorId', 'name department');
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    console.log('🎫 [BACKEND] Assigning token to appointment:', appointment.appointmentNo);

    // Get or create queue for this room
    let queue = await Queue.findOne({ roomNo: appointment.roomNo });
    
    if (!queue) {
      queue = new Queue({
        doctorId: appointment.doctorId._id,
        roomNo: appointment.roomNo,
        doctorName: appointment.doctorId.name,
        department: appointment.doctorId.department,
        status: 'active',
        patients: [],
      });
      console.log('📋 [BACKEND] Created new queue for room:', appointment.roomNo);
    }

    // Check if patient already in queue
    const existingPatient = queue.patients.find(p => p.appointmentId?.toString() === appointment._id.toString());
    
    if (existingPatient) {
      return res.status(400).json({ 
        success: false, 
        message: 'Patient already has a token in this queue',
        tokenNo: existingPatient.tokenNo 
      });
    }

    // Generate token
    const tokenNo = `T-${appointment.roomNo}-${queue.patients.length + 1}`;
    
    queue.patients.push({
      appointmentId: appointment._id,
      tokenNo,
      patientNo: appointment.patientId.patientNo,
      patientName: `${appointment.patientId.firstName} ${appointment.patientId.lastName}`,
      forceNo: appointment.patientId.forceNo,
      patientId: appointment.patientId._id,
      status: 'waiting',
      position: queue.patients.length,
    });

    // If this is the first patient, make them serving
    if (queue.patients.length === 1) {
      queue.patients[0].status = 'serving';
      queue.currentToken = tokenNo;
      queue.currentPatientIndex = 0;
      console.log('👤 [BACKEND] First patient automatically set as serving');
    }

    await queue.save();
    console.log('✅ [BACKEND] Token assigned:', tokenNo, 'To patient:', appointment.patientId.firstName);

    res.json({ 
      success: true, 
      message: 'Token assigned successfully',
      data: {
        tokenNo,
        patientName: `${appointment.patientId.firstName} ${appointment.patientId.lastName}`,
        roomNo: appointment.roomNo,
        position: queue.patients.length,
      }
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error assigning token:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Daily reset: archive today's appointments (mark completed) and clear queues
// Appointments stay in database for historical records; only queues are cleared
router.post('/admin/daily-reset', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    console.log('🔄 [BACKEND] Running daily appointment reset...');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayStr = todayStart.toISOString().split('T')[0];

    // Mark all active (scheduled/vitals_recorded) appointments as completed
    const archiveResult = await Appointment.updateMany(
      {
        status: { $in: ['scheduled', 'vitals_recorded'] },
        $or: [
          { date: todayStr },
          { date: { $lt: todayStr } },
          { createdAt: { $lte: todayEnd } }
        ]
      },
      { $set: { status: 'completed' } }
    );
    console.log('📋 [BACKEND] Archived', archiveResult.modifiedCount, 'appointments (marked as completed)');

    // Clear queue patients but keep queue structure
    const queues = await Queue.find({});
    let clearedPatients = 0;
    for (const queue of queues) {
      clearedPatients += queue.patients.length;
      queue.patients = [];
      queue.currentToken = null;
      queue.currentPatientIndex = 0;
      await queue.save();
    }
    console.log('🧹 [BACKEND] Cleared', clearedPatients, 'patients from', queues.length, 'queues');

    // Restore all doctors' slots to max
    const doctors = await User.find({ role: 'doctor' });
    for (const doctor of doctors) {
      doctor.available_slots = doctor.max_slots || 10;
      await doctor.save();
    }
    console.log('🎫 [BACKEND] Reset slots for', doctors.length, 'doctors');

    res.json({
      success: true,
      message: 'Daily reset completed. Appointments archived (not deleted), queues cleared, slots restored.',
      archivedAppointments: archiveResult.modifiedCount,
      clearedQueues: queues.length,
      clearedQueuePatients: clearedPatients,
      doctorSlotsReset: doctors.length,
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error in daily reset:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Legacy clear all appointments (keeps for backward compat but now archives instead of deleting)
router.delete('/admin/clear-all', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    console.log('🔄 [BACKEND] Archiving all appointments (soft reset)...');

    // Archive: mark all non-completed/non-cancelled appointments as completed
    const archiveResult = await Appointment.updateMany(
      { status: { $in: ['scheduled', 'vitals_recorded'] } },
      { $set: { status: 'completed' } }
    );

    // Clear queues (patients array) but keep queue structure
    const queues = await Queue.find({});
    let clearedPatients = 0;
    for (const queue of queues) {
      clearedPatients += queue.patients.length;
      queue.patients = [];
      queue.currentToken = null;
      queue.currentPatientIndex = 0;
      await queue.save();
    }

    // Restore doctor slots
    const doctors = await User.find({ role: 'doctor' });
    for (const doctor of doctors) {
      doctor.available_slots = doctor.max_slots || 10;
      await doctor.save();
    }

    console.log('✅ [BACKEND] Archived', archiveResult.modifiedCount, 'appointments, cleared', clearedPatients, 'queue patients');

    res.json({
      success: true,
      message: 'All appointments archived (not deleted). Queues cleared. Slots restored.',
      archivedAppointments: archiveResult.modifiedCount,
      clearedQueues: queues.length,
      clearedQueuePatients: clearedPatients,
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error clearing appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
