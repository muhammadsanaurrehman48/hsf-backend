import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Patient from '../models/Patient.js';
import Inventory from '../models/Inventory.js';
import {
  LAB_TEST_PRICES,
  RADIOLOGY_TEST_PRICES,
  OPD_CHARGES,
  getLabTestPrice,
  getRadiologyTestPrice,
  getOPDCharge,
  isMedicineFree,
} from '../utils/pricing.js';

const router = express.Router();

// ─── Service catalog with patient-type-aware pricing ───
router.get('/pricing/:patientType', verifyToken, checkRole(['billing', 'admin', 'receptionist']), async (req, res) => {
  try {
    const { patientType } = req.params;
    const FREE_TYPES = ['ASF', 'ASF_FAMILY', 'ASF_FOUNDATION', 'ASF_SCHOOL'];
    const isFree = FREE_TYPES.includes(patientType);
    const medsFree = isMedicineFree(patientType);

    // OPD services
    const opdServices = [
      {
        name: 'OPD Consultation',
        department: 'OPD',
        price: getOPDCharge(patientType),
        isFree: getOPDCharge(patientType) === 0,
      },
    ];

    // Lab services
    const labServices = Object.keys(LAB_TEST_PRICES).map(testName => ({
      name: testName,
      department: 'Laboratory',
      price: getLabTestPrice(testName, patientType),
      isFree,
    }));

    // Radiology services
    const radiologyServices = Object.keys(RADIOLOGY_TEST_PRICES).map(testName => ({
      name: testName,
      department: 'Radiology',
      price: getRadiologyTestPrice(testName, patientType),
      isFree,
    }));

    // Pharmacy items from inventory
    let pharmacyItems = [];
    try {
      const meds = await Inventory.find({
        category: { $in: ['Medicine', 'pharmacy'] },
        quantity: { $gt: 0 },
      }).select('name price quantity').sort({ name: 1 });

      pharmacyItems = meds.map(m => ({
        name: m.name,
        department: 'Pharmacy',
        price: medsFree ? 0 : (m.price || 0),
        originalPrice: m.price || 0,
        stock: m.quantity,
        isFree: medsFree,
      }));
    } catch (invErr) {
      console.warn('⚠️ Could not fetch inventory for pricing:', invErr.message);
    }

    res.json({
      success: true,
      data: {
        patientType,
        isFreePatient: isFree,
        medicinesFree: medsFree,
        opdCharge: getOPDCharge(patientType),
        services: {
          opd: opdServices,
          laboratory: labServices,
          radiology: radiologyServices,
          pharmacy: pharmacyItems,
        },
      },
    });
  } catch (err) {
    console.error('Error fetching pricing:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all invoices
router.get('/', verifyToken, checkRole(['billing', 'admin', 'receptionist']), async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('patientId', 'firstName lastName patientNo patientType forceNo')
      .sort({ createdAt: -1 });
    
    const data = invoices.map(i => ({
      id: i._id,
      invoiceNo: i.invoiceNo,
      patientId: i.patientId?._id,
      patientNo: i.patientNo || i.patientId?.patientNo,
      patientType: i.patientType || i.patientId?.patientType,
      forceNo: i.forceNo || i.patientId?.forceNo,
      patientName: i.patientName,
      source: i.source || 'Manual',
      items: i.items,
      total: i.total,
      discount: i.discount,
      netAmount: i.netAmount,
      amountPaid: i.amountPaid || 0,
      paymentStatus: i.paymentStatus,
      paymentMethod: i.paymentMethod,
      transactionId: i.transactionId,
      createdAt: i.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get invoice by ID
router.get('/:invoiceId', verifyToken, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate('patientId', 'firstName lastName patientNo patientType forceNo');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: invoice._id,
        ...invoice.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching invoice:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create invoice
router.post('/', verifyToken, checkRole(['billing', 'doctor', 'receptionist', 'admin']), async (req, res) => {
  try {
    const { patientId, patientName, items } = req.body;

    if (!patientId || !patientName || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Fetch patient to get patient type for auto-payment logic
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // ─── Re-price items server-side using pricing utils (source of truth) ───
    const FREE_TYPES = ['ASF', 'ASF_FAMILY', 'ASF_FOUNDATION', 'ASF_SCHOOL'];
    const isFree = FREE_TYPES.includes(patient.patientType);

    const pricedItems = items.map(item => {
      let price = Number(item.price) || 0;
      const dept = (item.department || '').toLowerCase();

      // Auto-price known services based on patient type
      if (dept === 'laboratory' || dept === 'lab') {
        const labPrice = getLabTestPrice(item.service || item.name, patient.patientType);
        if (labPrice > 0) price = labPrice;
      } else if (dept === 'radiology') {
        const radPrice = getRadiologyTestPrice(item.service || item.name, patient.patientType);
        if (radPrice > 0) price = radPrice;
      } else if (dept === 'opd') {
        // Use OPD charge if item looks like a consultation
        const isConsultation = /consult|opd|token/i.test(item.service || item.name || '');
        if (isConsultation) price = getOPDCharge(patient.patientType);
      } else if (dept === 'pharmacy') {
        // Medicines free for ASF types
        if (isMedicineFree(patient.patientType)) price = 0;
      }

      return {
        service: item.service || item.name,
        price,
        quantity: Number(item.quantity) || 1,
        department: item.department || 'General',
      };
    });

    const total = pricedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const invoiceCount = await Invoice.countDocuments();
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Accept explicit discount from frontend, or auto-discount for free patients
    const discount = isFree ? total : (req.body.discount != null ? Number(req.body.discount) : 0);
    const netAmount = Math.max(total - discount, 0);

    // Check if payment info was provided during creation (immediate payment)
    const immediatePayment = req.body.paymentMethod && req.body.amountPaid != null;
    let amountPaid = 0;
    let paymentStatus = 'pending';
    let paymentMethod = undefined;
    let transactionId = undefined;

    if (isFree || netAmount === 0) {
      // Free patients — auto-mark as paid
      amountPaid = netAmount;
      paymentStatus = 'paid';
    } else if (immediatePayment) {
      // Receptionist collected payment during creation
      amountPaid = Math.min(Number(req.body.amountPaid), netAmount);
      paymentMethod = req.body.paymentMethod;
      transactionId = req.body.transactionId || undefined;
      paymentStatus = amountPaid >= netAmount ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending');
    }

    const invoice = new Invoice({
      invoiceNo,
      patientId,
      patientNo: patient.patientNo,
      patientType: patient.patientType,
      forceNo: patient.forceNo,
      patientName,
      source: req.body.source || 'Manual',
      items: pricedItems,
      total,
      discount,
      netAmount,
      amountPaid,
      paymentStatus,
      paymentMethod,
      transactionId,
    });

    await invoice.save();

    const statusMsg = isFree
      ? 'Invoice created (Free - ASF)'
      : paymentStatus === 'paid'
        ? 'Invoice created & paid'
        : 'Invoice created';

    res.status(201).json({ 
      success: true, 
      message: statusMsg,
      data: {
        id: invoice._id,
        ...invoice.toObject(),
      }
    });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update invoice payment status
router.put('/:invoiceId', verifyToken, checkRole(['billing', 'admin', 'receptionist']), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const { paymentStatus, paymentMethod, transactionId, amountPaid, discount } = req.body;
    if (paymentStatus) invoice.paymentStatus = paymentStatus;
    if (paymentMethod) invoice.paymentMethod = paymentMethod;
    if (transactionId) invoice.transactionId = transactionId;
    if (amountPaid != null) {
      invoice.amountPaid = Number(amountPaid);
      // Recalculate balance: if fully paid, mark as paid
      const remaining = invoice.netAmount - invoice.amountPaid;
      if (remaining <= 0 && !paymentStatus) {
        invoice.paymentStatus = 'paid';
      }
    }
    if (discount != null) {
      invoice.discount = Number(discount);
      invoice.netAmount = Math.max(invoice.total - invoice.discount, 0);
    }

    await invoice.save();
    res.json({ 
      success: true, 
      message: 'Invoice updated', 
      data: {
        id: invoice._id,
        ...invoice.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get invoices for a patient
router.get('/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const invoices = await Invoice.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: invoices });
  } catch (err) {
    console.error('Error fetching patient invoices:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
