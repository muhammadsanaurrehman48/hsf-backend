import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';

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
