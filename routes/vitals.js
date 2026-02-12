import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Vitals from '../models/Vitals.js';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';

const router = express.Router();

// Get vitals for a patient
router.get('/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const vitals = await Vitals.find({ patientId: req.params.patientId })
      .populate('nurseId', 'name')
      .sort({ recordedAt: -1 });

    res.json({ success: true, data: vitals });
  } catch (err) {
    console.error('Error fetching patient vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get latest vitals for a patient
router.get('/patient/:patientId/latest', verifyToken, async (req, res) => {
  try {
    const vital = await Vitals.findOne({ patientId: req.params.patientId })
      .populate('nurseId', 'name')
      .sort({ recordedAt: -1 });

    if (!vital) {
      return res.status(404).json({ success: false, message: 'No vitals found' });
    }

    res.json({ success: true, data: vital });
  } catch (err) {
    console.error('Error fetching latest vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get vitals for an appointment
router.get('/appointment/:appointmentId', verifyToken, async (req, res) => {
  try {
    const vitals = await Vitals.findOne({ appointmentId: req.params.appointmentId })
      .populate('nurseId', 'name')
      .populate('patientId', 'firstName lastName patientNo')
      .sort({ recordedAt: -1 });

    if (!vitals) {
      return res.json({ success: true, data: null, message: 'No vitals recorded yet' });
    }

    res.json({ success: true, data: vitals });
  } catch (err) {
    console.error('Error fetching appointment vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create vitals (Nurse entry)
router.post('/', verifyToken, checkRole(['nurse', 'admin']), async (req, res) => {
  try {
    console.log('📝 [BACKEND] Vitals save request received');
    console.log('🔍 [BACKEND] User:', req.user.id, 'Role:', req.user.role);
    console.log('📋 [BACKEND] Request body:', JSON.stringify(req.body, null, 2));

    const {
      appointmentId,
      patientId,
      bloodPressure,
      pulse,
      temperature,
      spo2,
      respiratoryRate,
      notes,
    } = req.body;

    if (!patientId) {
      console.error('❌ [BACKEND] Patient ID missing in request');
      return res.status(400).json({ success: false, message: 'Patient ID required' });
    }

    // Handle patientId being an object (populated from frontend)
    let resolvedPatientId = patientId;
    if (typeof patientId === 'object' && patientId !== null) {
      resolvedPatientId = patientId._id || patientId.id || String(patientId);
      console.log('⚠️ [BACKEND] patientId was object, resolved to:', resolvedPatientId);
    } else {
      resolvedPatientId = String(patientId);
    }

    // Validate patientId is valid MongoDB ObjectId
    if (!resolvedPatientId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('❌ [BACKEND] Invalid patientId format:', resolvedPatientId);
      return res.status(400).json({ success: false, message: 'Invalid Patient ID format' });
    }

    // Check if patient exists
    const patient = await Patient.findById(resolvedPatientId);
    if (!patient) {
      console.error('❌ [BACKEND] Patient not found:', resolvedPatientId);
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const vital = new Vitals({
      appointmentId,
      patientId: resolvedPatientId,
      nurseId: req.user.id,
      bloodPressure,
      pulse: pulse ? parseInt(pulse) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      spo2: spo2 ? parseFloat(spo2) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
      notes,
      recordedAt: new Date(),
    });

    await vital.save();
    console.log('✅ [BACKEND] Vitals recorded successfully for patient:', patient.firstName, patient.lastName);

    // Update appointment status to vitals_recorded and notify doctor
    if (appointmentId) {
      // Update appointment status
      await Appointment.findByIdAndUpdate(appointmentId, { status: 'vitals_recorded' });
      console.log('📝 [BACKEND] Appointment status updated to vitals_recorded');

      // Update queue patient status
      const appointment = await Appointment.findById(appointmentId).select('doctorId appointmentNo roomNo');
      if (appointment?.roomNo) {
        const Queue = (await import('../models/Queue.js')).default;
        const queue = await Queue.findOne({ roomNo: appointment.roomNo });
        if (queue) {
          const queuePatient = queue.patients.find(p => p.appointmentId?.toString() === appointmentId);
          if (queuePatient) {
            queuePatient.status = 'vitals_recorded';
            await queue.save();
            console.log('📋 [BACKEND] Queue patient status updated to vitals_recorded');
          }
        }
      }

      if (appointment?.doctorId) {
        await Notification.create({
          userId: appointment.doctorId,
          type: 'vitals_recorded',
          title: 'Patient Vitals Recorded',
          message: `Vitals recorded for appointment ${appointment.appointmentNo}: BP: ${bloodPressure}, Temp: ${temperature}°C, SPO2: ${spo2}%`,
          relatedId: appointmentId,
          relatedType: 'vitals',
          actionUrl: `/doctor/appointments/${appointmentId}`,
        });
        console.log('🔔 [BACKEND] Doctor notified about vitals');
      }
    }

    res.status(201).json({
      success: true,
      message: 'Vitals recorded successfully',
      data: {
        id: vital._id,
        ...vital.toObject(),
      },
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error recording vitals:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: `Server error: ${err.message}`,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Update vitals
router.put('/:vitalId', verifyToken, checkRole(['nurse', 'admin']), async (req, res) => {
  try {
    const vital = await Vitals.findByIdAndUpdate(
      req.params.vitalId,
      { $set: req.body },
      { new: true }
    );

    if (!vital) {
      return res.status(404).json({ success: false, message: 'Vital record not found' });
    }

    res.json({
      success: true,
      message: 'Vitals updated',
      data: {
        id: vital._id,
        ...vital.toObject(),
      },
    });
  } catch (err) {
    console.error('Error updating vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
