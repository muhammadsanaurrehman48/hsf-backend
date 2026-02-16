import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Patient from '../models/Patient.js';

const router = express.Router();

const mapPatient = (p) => ({
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
  householdId: p.householdId || '',
  relationToHead: p.relationToHead || 'self',
  familyHead: p.familyHead || null,
  isHouseholdHead: p.isHouseholdHead,
  emergencyContact: p.emergencyContact || {},
  allergies: p.allergies || '',
  existingConditions: p.existingConditions || '',
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

// Get all patients
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('📋 [PATIENT] Fetching all patients');
    const patients = await Patient.find().sort({ createdAt: -1 });
    console.log(`📋 [PATIENT] Found ${patients.length} patients`);
    
    const patientsData = patients.map(mapPatient);
    
    res.json({ success: true, data: patientsData });
  } catch (err) {
    console.error('❌ [PATIENT] Error fetching patients:', err);
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

    const results = patients.map(mapPatient);

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('❌ [PATIENT] Error searching patients:', err);
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

    const patientData = mapPatient(patient);

    let family = [];
    if (patient.householdId) {
      const householdMembers = await Patient.find({ householdId: patient.householdId }).sort({ createdAt: -1 });
      family = householdMembers.map(mapPatient);
    }

    console.log('✅ [PATIENT] Patient fetched:', patientData.patientNo);
    res.json({ 
      success: true, 
      data: patientData,
      family,
    });
  } catch (err) {
    console.error('❌ [PATIENT] Error fetching patient:', err);
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
      familyMembers,
    } = req.body;

    // Validate patient type
    if (!patientType || !['ASF', 'ASF_FAMILY', 'ASF_SCHOOL', 'CIVILIAN'].includes(patientType)) {
      return res.status(400).json({ success: false, message: 'Invalid patient type' });
    }

    // Force No is required for ASF, ASF_FAMILY, ASF_SCHOOL
    if ((patientType === 'ASF' || patientType === 'ASF_FAMILY' || patientType === 'ASF_SCHOOL') && !forceNo) {
      return res.status(400).json({ success: false, message: 'Force No required for ASF patients' });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const patientCount = await Patient.countDocuments();
    const baseNumber = patientCount + 1001;
    const patientNo = `PAT-${String(baseNumber).padStart(6, '0')}`;

    const householdId = patientNo;

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
      householdId,
      relationToHead: 'self',
      familyHead: null,
      isHouseholdHead: true,
    });

    await newPatient.save();

    const createdFamilyMembers = [];
    if (Array.isArray(familyMembers) && patientType === 'ASF') {
      const usableFamily = familyMembers.filter((fm) => {
        return fm.name || fm.gender || fm.dateOfBirth || fm.bloodGroup || fm.relationToHead || fm.phone || fm.cnic;
      });

      if (usableFamily.length > 0) {
        let counter = baseNumber;
        const toInsert = [];
        for (const fm of usableFamily) {
          const fullName = (fm.name || `${fm.firstName || ''} ${fm.lastName || ''}`).trim();
          if (!fullName) {
            return res.status(400).json({ success: false, message: 'Family member name is required' });
          }
          const [fmFirst, ...fmRest] = fullName.split(/\s+/);
          const fmLast = fmRest.join(' ') || fmFirst;

          if (!fm.gender || !fm.dateOfBirth || !fm.bloodGroup || !fm.relationToHead) {
            return res.status(400).json({ success: false, message: 'Family member is missing required fields' });
          }

          counter += 1;
          const fmPatientNo = `PAT-${String(counter).padStart(6, '0')}`;

          toInsert.push({
            patientNo: fmPatientNo,
            patientType: 'ASF_FAMILY',
            forceNo,
            firstName: fmFirst,
            lastName: fmLast,
            gender: fm.gender,
            dateOfBirth: fm.dateOfBirth,
            bloodGroup: fm.bloodGroup,
            cnic: fm.cnic,
            phone: fm.phone,
            email: fm.email,
            address: fm.address || address,
            city: fm.city || city,
            emergencyContact: fm.emergencyContact,
            allergies: fm.allergies,
            existingConditions: fm.existingConditions,
            householdId,
            relationToHead: fm.relationToHead,
            familyHead: newPatient._id,
            isHouseholdHead: false,
          });
        }

        if (toInsert.length > 0) {
          const inserted = await Patient.insertMany(toInsert);
          createdFamilyMembers.push(...inserted.map(mapPatient));
        }
      }
    }

    const patientData = mapPatient(newPatient);

    console.log('✅ [PATIENT] Patient created successfully:', patientData.patientNo);
    
    res.status(201).json({ 
      success: true, 
      message: 'Patient registered successfully', 
      data: patientData,
      family: createdFamilyMembers,
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
    
    const responseData = mapPatient(patient);

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
