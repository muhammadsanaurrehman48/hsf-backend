import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Vitals from '../models/Vitals.js';
import CareNote from '../models/CareNote.js';
import WardPatient from '../models/WardPatient.js';

const router = express.Router();

// Record patient vitals
router.post('/vitals', verifyToken, checkRole(['nurse']), async (req, res) => {
  try {
    const { patientId, bloodPressure, pulse, temperature, spo2, respiratoryRate, notes } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Missing patient ID' });
    }

    const vitals = new Vitals({
      patientId,
      nurseId: req.user.id,
      bloodPressure,
      pulse,
      temperature,
      spo2,
      respiratoryRate,
      notes,
      recordedAt: new Date(),
    });

    await vitals.save();
    res.status(201).json({ 
      success: true, 
      message: 'Vitals recorded', 
      data: {
        id: vitals._id,
        ...vitals.toObject(),
      }
    });
  } catch (err) {
    console.error('Error recording vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get vitals for a patient
router.get('/vitals/patient/:patientId', verifyToken, checkRole(['nurse', 'doctor']), async (req, res) => {
  try {
    const vitals = await Vitals.find({ patientId: req.params.patientId })
      .populate('nurseId', 'name')
      .sort({ recordedAt: -1 });
    res.json({ success: true, data: vitals });
  } catch (err) {
    console.error('Error fetching vitals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add care note
router.post('/care-notes', verifyToken, checkRole(['nurse']), async (req, res) => {
  try {
    const { patientId, note } = req.body;

    if (!patientId || !note) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const careNote = new CareNote({
      patientId,
      nurseId: req.user.id,
      note,
    });

    await careNote.save();
    res.status(201).json({ 
      success: true, 
      message: 'Care note added', 
      data: {
        id: careNote._id,
        ...careNote.toObject(),
      }
    });
  } catch (err) {
    console.error('Error adding care note:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get care notes for a patient
router.get('/care-notes/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const notes = await CareNote.find({ patientId: req.params.patientId })
      .populate('nurseId', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: notes });
  } catch (err) {
    console.error('Error fetching care notes:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get admitted patients - accessible to receptionist and nurse
router.get('/patients', verifyToken, checkRole(['nurse', 'receptionist']), async (req, res) => {
  try {
    console.log('📥 [BACKEND] Fetching admitted patients...');
    
    const patients = await WardPatient.find({ status: 'admitted' })
      .populate('patientId', 'firstName lastName mrNo patientNo')
      .sort({ admitDate: -1 });
    
    console.log('✅ [BACKEND] Found', patients.length, 'admitted patients');
    
    const data = patients.map(p => ({
      id: p._id,
      patientId: p.patientId?._id,
      name: p.name,
      mrNo: p.patientNo,
      patientNo: p.patientNo,
      ward: p.ward,
      bed: p.bed,
      admitDate: p.admitDate,
      doctor: p.doctor,
      doctorId: p.doctorId,
      status: p.status,
    }));

    console.log('📤 [BACKEND] Sending', data.length, 'formatted admission records');

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ [BACKEND] Error fetching ward patients:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admit patient - accessible to receptionist, nurse, doctor, admin
router.post('/admit', verifyToken, checkRole(['receptionist', 'nurse', 'doctor', 'admin']), async (req, res) => {
  try {
    const { patientId, name, mrNo, patientNo, ward, bed, doctor, doctorId } = req.body;

    console.log('📝 [BACKEND] Admission request:', { patientId, name, mrNo, patientNo, ward, bed, doctor, doctorId });

    if (!patientId || !name || !ward || !bed) {
      console.error('❌ [BACKEND] Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required fields (patientId, name, ward, bed)' });
    }

    // Use either mrNo or patientNo - they're the same thing
    const finalPatientNo = patientNo || mrNo || '';
    
    // Build admission object with only valid fields
    const admissionObj = {
      patientId,
      name,
      patientNo: finalPatientNo,
      ward,
      bed,
      doctor,
      admitDate: new Date(),
      status: 'admitted',
    };

    // Only add doctorId if it's a valid ObjectId format
    if (doctorId && typeof doctorId === 'string' && doctorId.match(/^[0-9a-fA-F]{24}$/)) {
      admissionObj.doctorId = doctorId;
      console.log('✅ [BACKEND] Doctor ID is valid ObjectId:', doctorId);
    } else if (doctorId) {
      console.warn('⚠️ [BACKEND] Doctor ID is not a valid ObjectId, skipping:', doctorId);
    }
    
    const wardPatient = new WardPatient(admissionObj);

    console.log('💾 [BACKEND] Saving to WardPatient:', {
      patientId,
      name,
      patientNo: finalPatientNo,
      ward,
      bed,
      doctor,
      doctorId: admissionObj.doctorId || 'not set',
    });

    await wardPatient.save();
    
    console.log('✅ [BACKEND] Patient admitted successfully:', wardPatient._id);

    res.status(201).json({ 
      success: true, 
      message: 'Patient admitted', 
      data: {
        id: wardPatient._id,
        ...wardPatient.toObject(),
      }
    });
  } catch (err) {
    console.error('❌ [BACKEND] Error admitting patient:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Discharge patient
router.put('/discharge/:wardPatientId', verifyToken, checkRole(['nurse', 'doctor', 'admin']), async (req, res) => {
  try {
    const wardPatient = await WardPatient.findById(req.params.wardPatientId);
    if (!wardPatient) {
      return res.status(404).json({ success: false, message: 'Ward patient not found' });
    }

    wardPatient.status = 'discharged';
    await wardPatient.save();

    res.json({ success: true, message: 'Patient discharged' });
  } catch (err) {
    console.error('Error discharging patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
