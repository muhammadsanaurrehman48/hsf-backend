import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Vitals from '../models/Vitals.js';
import Appointment from '../models/Appointment.js';

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
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const vitals = await Vitals.find({ 
      patientId: appointment.patientId,
      recordedAt: { 
        $gte: new Date(appointment.date).setHours(0, 0, 0, 0),
      }
    }).populate('nurseId', 'name');

    res.json({ success: true, data: vitals });
  } catch (err) {
    console.error('Error fetching appointment vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create vitals (Nurse entry)
router.post('/', verifyToken, checkRole(['nurse', 'admin']), async (req, res) => {
  try {
    const {
      patientId,
      bloodPressure,
      pulse,
      temperature,
      spo2,
      respiratoryRate,
      notes,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID required' });
    }

    const vital = new Vitals({
      patientId,
      nurseId: req.user.userId, // Assuming middleware sets userId
      bloodPressure,
      pulse: pulse ? parseInt(pulse) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      spo2: spo2 ? parseFloat(spo2) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
      notes,
      recordedAt: new Date(),
    });

    await vital.save();

    res.status(201).json({
      success: true,
      message: 'Vitals recorded successfully',
      data: {
        id: vital._id,
        ...vital.toObject(),
      },
    });
  } catch (err) {
    console.error('Error recording vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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
