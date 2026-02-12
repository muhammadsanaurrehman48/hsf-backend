import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get all prescriptions
router.get('/', verifyToken, async (req, res) => {
  try {
    const prescriptions = await Prescription.find()
      .populate('patientId', 'firstName lastName mrNo forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    
    const data = prescriptions.map(p => ({
      id: p._id,
      rxNo: p.rxNo,
      patientId: p.patientId?._id,
      patient: p.patientId ? `${p.patientId.firstName} ${p.patientId.lastName}` : 'Unknown',
      mrNo: p.mrNo || p.patientId?.mrNo,
      forceNo: p.forceNo || p.patientId?.forceNo,
      doctorId: p.doctorId?._id,
      doctor: p.doctorId?.name,
      diagnosis: p.diagnosis,
      medicines: p.medicines,
      labTests: p.labTests,
      radiologyTests: p.radiologyTests,
      notes: p.notes,
      status: p.status,
      createdAt: p.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching prescriptions:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get prescription by ID
router.get('/:prescriptionId', verifyToken, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.prescriptionId)
      .populate('patientId', 'firstName lastName mrNo forceNo')
      .populate('doctorId', 'name department');
    
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: prescription._id,
        ...prescription.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching prescription:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get prescriptions by patient
router.get('/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.params.patientId })
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: prescriptions });
  } catch (err) {
    console.error('Error fetching patient prescriptions:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create prescription (doctor only)
router.post('/', verifyToken, checkRole(['doctor']), async (req, res) => {
  try {
    const {
      patientId,
      mrNo,
      forceNo,
      diagnosis,
      medicines,
      labTests,
      radiologyTests,
      notes,
    } = req.body;

    if (!patientId || !diagnosis || !medicines || medicines.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const prescriptionCount = await Prescription.countDocuments();
    const rxNo = `RX-${String(prescriptionCount + 456789).padStart(6, '0')}`;

    const newPrescription = new Prescription({
      rxNo,
      patientId,
      mrNo,
      forceNo,
      doctorId: req.user.id,
      diagnosis,
      medicines,
      labTests: labTests || [],
      radiologyTests: radiologyTests || [],
      notes,
      status: 'pending',
    });

    await newPrescription.save();
    console.log('✅ [BACKEND] Prescription created:', rxNo);

    // Get patient and doctor info for notifications
    const patient = await Patient.findById(patientId);
    const doctor = await User.findById(req.user.id);
    
    // Send notification to lab staff if lab tests requested
    if (labTests && labTests.length > 0) {
      const labStaff = await User.find({ role: 'laboratory' });
      console.log('🔔 [BACKEND] Notifying', labStaff.length, 'lab staff about new lab requests');
      
      for (const staff of labStaff) {
        await Notification.create({
          userId: staff._id,
          type: 'lab_request_created',
          title: 'New Lab Request',
          message: `New lab request from Dr. ${doctor?.name} for patient ${patient?.firstName} ${patient?.lastName} (${patient?.patientNo}). Tests: ${labTests.join(', ')}`,
          relatedId: newPrescription._id,
          relatedType: 'prescription',
          actionUrl: `/laboratory/requests`,
        });
      }
      console.log('✅ [BACKEND] Lab notifications created');
    }

    // Send notification to radiology staff if radiology tests requested
    if (radiologyTests && radiologyTests.length > 0) {
      const radiologyStaff = await User.find({ role: 'radiologist' });
      console.log('🔔 [BACKEND] Notifying', radiologyStaff.length, 'radiology staff about new radiology requests');
      
      for (const staff of radiologyStaff) {
        await Notification.create({
          userId: staff._id,
          type: 'radiology_request_created',
          title: 'New Radiology Request',
          message: `New radiology request from Dr. ${doctor?.name} for patient ${patient?.firstName} ${patient?.lastName} (${patient?.patientNo}). Tests: ${radiologyTests.join(', ')}`,
          relatedId: newPrescription._id,
          relatedType: 'prescription',
          actionUrl: `/radiologist/requests`,
        });
      }
      console.log('✅ [BACKEND] Radiology notifications created');
    }

    res.status(201).json({ 
      success: true, 
      message: 'Prescription created', 
      data: {
        id: newPrescription._id,
        ...newPrescription.toObject(),
      }
    });
  } catch (err) {
    console.error('Error creating prescription:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update prescription
router.put('/:prescriptionId', verifyToken, checkRole(['doctor', 'pharmacy', 'pharmacist']), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.prescriptionId);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const { status, medicines, notes } = req.body;
    if (status) prescription.status = status;
    if (medicines) prescription.medicines = medicines;
    if (notes) prescription.notes = notes;

    await prescription.save();
    res.json({ 
      success: true, 
      message: 'Prescription updated', 
      data: {
        id: prescription._id,
        ...prescription.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating prescription:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
