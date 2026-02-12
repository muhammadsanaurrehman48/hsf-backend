import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';
import Inventory from '../models/Inventory.js';
import Invoice from '../models/Invoice.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get all prescriptions for pharmacy
// Accessible to: pharmacy staff, pharmacists, doctors (view only), and admins
router.get('/prescriptions', verifyToken, checkRole(['pharmacy', 'pharmacist', 'doctor', 'admin']), async (req, res) => {
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
      patientName: p.patientId ? `${p.patientId.firstName} ${p.patientId.lastName}` : 'Unknown',
      mrNo: p.mrNo || p.patientId?.mrNo,
      forceNo: p.forceNo || p.patientId?.forceNo,
      doctorId: p.doctorId?._id,
      doctor: p.doctorId?.name,
      diagnosis: p.diagnosis,
      medicines: p.medicines || [],
      status: p.status,
      date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      createdAt: p.createdAt,
      dispensedAt: p.dispensedAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching prescriptions for pharmacy:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get prescription details
// Accessible to: pharmacy staff, pharmacists, doctors (view only), and admins
router.get('/prescription/:prescriptionId', verifyToken, checkRole(['pharmacy', 'pharmacist', 'doctor', 'admin']), async (req, res) => {
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
    const prescription = await Prescription.findById(req.params.prescriptionId)
      .populate('patientId', 'firstName lastName patientNo patientType forceNo')
      .populate('doctorId', 'name');
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    prescription.status = 'dispensed';
    prescription.dispensedAt = new Date();
    prescription.dispensedBy = req.user.id;
    await prescription.save();

    // dispensedItems: [{name, quantity}] — optional overrides from pharmacist
    const { dispensedItems } = req.body || {};

    // Deduct inventory and build invoice items with real prices
    const invoiceItems = [];
    const inventoryUpdates = [];

    for (const med of (prescription.medicines || [])) {
      // Find quantity override from pharmacist, default to 1
      const override = Array.isArray(dispensedItems)
        ? dispensedItems.find(d => d.name === med.name)
        : null;
      const qtyToDispense = override ? Number(override.quantity) || 1 : 1;

      // Find matching inventory item (case-insensitive)
      const invItem = await Inventory.findOne({
        name: { $regex: new RegExp(`^${med.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        category: { $in: ['Medicine', 'pharmacy'] },
      });

      if (invItem && qtyToDispense > 0) {
        // Deduct from inventory
        const previousQty = invItem.quantity;
        invItem.quantity = Math.max(0, invItem.quantity - qtyToDispense);

        // Update stock status
        if (invItem.quantity <= 0) {
          invItem.status = 'out-of-stock';
        } else if (invItem.quantity <= (invItem.minStock || 0)) {
          invItem.status = 'low-stock';
        } else {
          invItem.status = 'in-stock';
        }

        await invItem.save();
        inventoryUpdates.push({
          name: med.name,
          previous: previousQty,
          dispensed: qtyToDispense,
          remaining: invItem.quantity,
          status: invItem.status,
        });

        invoiceItems.push({
          service: `${med.name}${med.dosage ? ` (${med.dosage})` : ''}`,
          price: invItem.price || 0,
          quantity: qtyToDispense,
        });
      } else {
        // No matching inventory item — add to invoice with price 0
        invoiceItems.push({
          service: `${med.name}${med.dosage ? ` (${med.dosage})` : ''}`,
          price: 0,
          quantity: qtyToDispense,
        });
      }
    }

    console.log('📦 [PHARMACY] Inventory updates:', inventoryUpdates);

    // Create invoice for receptionist
    try {
      const patient = prescription.patientId;
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : (prescription.mrNo || 'Unknown Patient');
      const isAutoPayment = patient && (patient.patientType === 'ASF' || patient.patientType === 'ASF_FAMILY');

      if (invoiceItems.length > 0) {
        const total = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const invoiceCount = await Invoice.countDocuments();
        const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

        const invoice = new Invoice({
          invoiceNo,
          patientId: patient?._id || prescription.patientId,
          patientNo: patient?.patientNo || prescription.mrNo,
          patientType: patient?.patientType,
          forceNo: patient?.forceNo || prescription.forceNo,
          patientName,
          items: invoiceItems,
          total,
          discount: isAutoPayment ? total : 0,
          netAmount: isAutoPayment ? 0 : total,
          paymentStatus: isAutoPayment ? 'auto-paid' : 'pending',
          autoPayment: isAutoPayment || false,
        });
        await invoice.save();
        console.log('✅ [PHARMACY] Invoice created:', invoiceNo, 'for patient:', patientName, 'Total: Rs.', total);

        // Notify receptionist staff
        const receptionists = await User.find({ role: { $in: ['receptionist', 'billing'] } });
        for (const staff of receptionists) {
          await Notification.create({
            userId: staff._id,
            type: 'invoice_created',
            title: 'New Pharmacy Invoice',
            message: `Prescription ${prescription.rxNo} dispensed for ${patientName}. Invoice ${invoiceNo} created (Rs. ${total})${isAutoPayment ? ' (Auto-Paid)' : ' - payment pending'}.`,
            relatedId: invoice._id,
            relatedType: 'invoice',
            actionUrl: '/receptionist/billing',
          });
        }
        console.log('✅ [PHARMACY] Notified', receptionists.length, 'reception/billing staff');
      }
    } catch (invoiceErr) {
      console.error('⚠️ [PHARMACY] Error creating invoice (prescription still dispensed):', invoiceErr);
    }

    res.json({ 
      success: true, 
      message: 'Prescription dispensed and invoice created', 
      data: {
        id: prescription._id,
        ...prescription.toObject(),
        inventoryUpdates,
      }
    });
  } catch (err) {
    console.error('Error dispensing prescription:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Pharmacy inventory
// GET accessible to all staff for viewing
router.get('/inventory', verifyToken, checkRole(['pharmacy', 'pharmacist', 'doctor', 'admin', 'nurse']), async (req, res) => {
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
