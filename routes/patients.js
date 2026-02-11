import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Patient from '../models/Patient.js';

const router = express.Router();

// Get all patients
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('📋 [PATIENT] Fetching all patients');
    const patients = await Patient.find().sort({ createdAt: -1 });
    console.log(`📋 [PATIENT] Found ${patients.length} patients`);
    
    const patientsData = patients.map(p => ({
      id: p._id,
      patientNo: p.patientNo,
      patientType: p.patientType,
      forceNo: p.forceNo || '',
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      fullName: `${p.firstName} ${p.lastName}`,
      mrNo: p.patientNo,
      age: p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : null,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth || '',
      bloodGroup: p.bloodGroup || '',
      cnic: p.cnic || '',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      city: p.city || '',
      emergencyContact: p.emergencyContact || {},
      allergies: p.allergies || '',
      existingConditions: p.existingConditions || '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    
    res.json({ success: true, data: patientsData });
  } catch (err) {
    console.error('❌ [PATIENT] Error fetching patients:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// Get patient by ID
router.get('/:patientId', verifyToken, async (req, res) => {
  try {
    console.log('👤 [PATIENT] Fetching patient:', req.params.patientId);
    const patient = await Patient.findById(req.params.patientId);
    
    if (!patient) {
      console.error('❌ [PATIENT] Patient not found:', req.params.patientId);
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const patientData = {
      id: patient._id,
      patientNo: patient.patientNo,
      patientType: patient.patientType,
      forceNo: patient.forceNo || '',
      firstName: patient.firstName,
      lastName: patient.lastName,
      name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      fullName: `${patient.firstName} ${patient.lastName}`,
      mrNo: patient.patientNo,
      age: patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : null,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth || '',
      bloodGroup: patient.bloodGroup || '',
      cnic: patient.cnic || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      city: patient.city || '',
      emergencyContact: patient.emergencyContact || {},
      allergies: patient.allergies || '',
      existingConditions: patient.existingConditions || '',
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };

    console.log('✅ [PATIENT] Patient fetched:', patientData.patientNo);
    res.json({ 
      success: true, 
      data: patientData
    });
  } catch (err) {
    console.error('❌ [PATIENT] Error fetching patient:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// Search patients by name or patient number
router.get('/search/query', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    console.log('🔍 [PATIENT] Searching for:', q);
    
    const patients = await Patient.find({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { patientNo: { $regex: q, $options: 'i' } },
        { forceNo: { $regex: q, $options: 'i' } },
      ],
    });

    console.log(`🔍 [PATIENT] Found ${patients.length} matching patients`);

    const results = patients.map(p => ({
      id: p._id,
      patientNo: p.patientNo,
      patientType: p.patientType,
      forceNo: p.forceNo || '',
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      fullName: `${p.firstName} ${p.lastName}`,
      mrNo: p.patientNo,
      age: p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : null,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth || '',
      bloodGroup: p.bloodGroup || '',
      cnic: p.cnic || '',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      city: p.city || '',
      emergencyContact: p.emergencyContact || {},
      allergies: p.allergies || '',
      existingConditions: p.existingConditions || '',
      createdAt: p.createdAt,
    }));

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('❌ [PATIENT] Error searching patients:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
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

    const patientData = {
      id: newPatient._id,
      patientNo: newPatient.patientNo,
      patientType: newPatient.patientType,
      forceNo: newPatient.forceNo || '',
      firstName: newPatient.firstName,
      lastName: newPatient.lastName,
      name: `${newPatient.firstName || ''} ${newPatient.lastName || ''}`.trim(),
      fullName: `${newPatient.firstName} ${newPatient.lastName}`,
      mrNo: newPatient.patientNo,
      age: newPatient.dateOfBirth ? new Date().getFullYear() - new Date(newPatient.dateOfBirth).getFullYear() : null,
      gender: newPatient.gender,
      dateOfBirth: newPatient.dateOfBirth || '',
      bloodGroup: newPatient.bloodGroup || '',
      cnic: newPatient.cnic || '',
      phone: newPatient.phone || '',
      email: newPatient.email || '',
      address: newPatient.address || '',
      city: newPatient.city || '',
      emergencyContact: newPatient.emergencyContact || {},
      allergies: newPatient.allergies || '',
      existingConditions: newPatient.existingConditions || '',
      createdAt: newPatient.createdAt,
    };

    console.log('✅ [PATIENT] Patient created successfully:', patientData.patientNo);
    
    res.status(201).json({ 
      success: true, 
      message: 'Patient registered successfully', 
      data: patientData
    });
  } catch (err) {
    console.error('❌ [PATIENT] Error creating patient:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// Update patient
router.put('/:patientId', verifyToken, checkRole(['receptionist', 'admin', 'doctor']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated
    delete updateData.patientNo;
    delete updateData.createdAt;
    delete updateData._id;

    console.log('📝 [PATIENT] Updating patient:', patientId);
    console.log('📝 [PATIENT] Update data:', updateData);

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!patient) {
      console.error('❌ [PATIENT] Patient not found:', patientId);
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    console.log('✅ [PATIENT] Patient updated successfully:', patientId);
    
    const responseData = {
      id: patient._id,
      patientNo: patient.patientNo,
      patientType: patient.patientType,
      forceNo: patient.forceNo || '',
      firstName: patient.firstName,
      lastName: patient.lastName,
      name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      fullName: `${patient.firstName} ${patient.lastName}`,
      mrNo: patient.patientNo,
      age: patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : null,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth || '',
      bloodGroup: patient.bloodGroup || '',
      cnic: patient.cnic || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      city: patient.city || '',
      emergencyContact: patient.emergencyContact || {},
      allergies: patient.allergies || '',
      existingConditions: patient.existingConditions || '',
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };

    res.json({ 
      success: true, 
      message: 'Patient updated successfully', 
      data: responseData
    });
  } catch (err) {
    console.error('❌ [PATIENT] Error updating patient:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// Delete patient
router.delete('/:patientId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    console.log('🗑️  [PATIENT] Deleting patient:', req.params.patientId);
    const patient = await Patient.findByIdAndDelete(req.params.patientId);
    if (!patient) {
      console.error('❌ [PATIENT] Patient not found for deletion:', req.params.patientId);
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    console.log('✅ [PATIENT] Patient deleted successfully:', patient.patientNo);
    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (err) {
    console.error('❌ [PATIENT] Error deleting patient:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

export default router;
