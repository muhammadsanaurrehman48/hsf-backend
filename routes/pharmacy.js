import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';
import Inventory from '../models/Inventory.js';

const router = express.Router();

// Get all prescriptions for pharmacy
router.get('/prescriptions', verifyToken, checkRole(['pharmacy', 'pharmacist']), async (req, res) => {
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
      status: p.status,
      createdAt: p.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching prescriptions for pharmacy:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get prescription details
router.get('/prescription/:prescriptionId', verifyToken, checkRole(['pharmacy', 'pharmacist']), async (req, res) => {
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

// Dispense prescription
router.put('/dispense/:prescriptionId', verifyToken, checkRole(['pharmacy', 'pharmacist']), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.prescriptionId);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    prescription.status = 'dispensed';
    prescription.dispensedAt = new Date();
    prescription.dispensedBy = req.user.id;

    await prescription.save();
    res.json({ 
      success: true, 
      message: 'Prescription dispensed', 
      data: {
        id: prescription._id,
        ...prescription.toObject(),
      }
    });
  } catch (err) {
    console.error('Error dispensing prescription:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Pharmacy inventory
router.get('/inventory', verifyToken, checkRole(['pharmacy', 'pharmacist']), async (req, res) => {
  try {
    const inventory = await Inventory.find({ category: 'pharmacy' }).sort({ name: 1 });
    const data = inventory.map(i => ({
      id: i._id,
      name: i.name,
      strength: i.strength,
      quantity: i.quantity,
      unit: i.unit,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching pharmacy inventory:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update medicine inventory
router.put('/inventory/:medicineId', verifyToken, checkRole(['pharmacy', 'pharmacist']), async (req, res) => {
  try {
    const medicine = await Inventory.findById(req.params.medicineId);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    const { quantity, name, strength } = req.body;
    if (quantity !== undefined) medicine.quantity = quantity;
    if (name) medicine.name = name;
    if (strength) medicine.strength = strength;

    await medicine.save();
    res.json({ success: true, message: 'Inventory updated' });
  } catch (err) {
    console.error('Error updating pharmacy inventory:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
