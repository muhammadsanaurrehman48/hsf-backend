import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Patient from '../models/Patient.js';

const router = express.Router();

// Get all patients
router.get('/', verifyToken, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    const patientsData = patients.map(p => ({
      id: p._id,
      patientNo: p.patientNo,
      patientType: p.patientType,
      forceNo: p.forceNo,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth,
      bloodGroup: p.bloodGroup,
      cnic: p.cnic,
      phone: p.phone,
      email: p.email,
      address: p.address,
      city: p.city,
      emergencyContact: p.emergencyContact,
      allergies: p.allergies,
      existingConditions: p.existingConditions,
      createdAt: p.createdAt,
    }));
    res.json({ success: true, data: patientsData });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get patient by ID
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: patient._id,
        ...patient.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Search patients by name or patient number
router.get('/search/query', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const patients = await Patient.find({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { patientNo: { $regex: q, $options: 'i' } },
        { forceNo: { $regex: q, $options: 'i' } },
      ],
    });

    const results = patients.map(p => ({
      id: p._id,
      ...p.toObject(),
    }));

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error searching patients:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new patient
router.post('/', verifyToken, checkRole(['receptionist', 'admin']), async (req, res) => {
  try {
    const {
      patientType,
      forceNo,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      bloodGroup,
      cnic,
      phone,
      email,
      address,
      city,
      emergencyContact,
      allergies,
      existingConditions,
    } = req.body;

    // Validate patient type
    if (!patientType || !['ASF', 'ASF_FAMILY', 'CIVILIAN'].includes(patientType)) {
      return res.status(400).json({ success: false, message: 'Invalid patient type' });
    }

    // Force No is required for ASF and ASF_FAMILY
    if ((patientType === 'ASF' || patientType === 'ASF_FAMILY') && !forceNo) {
      return res.status(400).json({ success: false, message: 'Force No required for ASF patients' });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const patientCount = await Patient.countDocuments();
    const patientNo = `PAT-${String(patientCount + 1001).padStart(6, '0')}`;

    const newPatient = new Patient({
      patientNo,
      patientType,
      forceNo: patientType !== 'CIVILIAN' ? forceNo : undefined,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      bloodGroup,
      cnic,
      phone,
      email,
      address,
      city,
      emergencyContact,
      allergies,
      existingConditions,
    });

    await newPatient.save();
    res.status(201).json({ 
      success: true, 
      message: 'Patient registered', 
      data: {
        id: newPatient._id,
        ...newPatient.toObject(),
      }
    });
  } catch (err) {
    console.error('Error creating patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update patient
router.put('/:patientId', verifyToken, checkRole(['receptionist', 'admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.patientId,
      { $set: req.body },
      { new: true }
    );
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    res.json({ 
      success: true, 
      message: 'Patient updated', 
      data: {
        id: patient._id,
        ...patient.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete patient
router.delete('/:patientId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    res.json({ success: true, message: 'Patient deleted' });
  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
