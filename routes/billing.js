import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Patient from '../models/Patient.js';
import Inventory from '../models/Inventory.js';
import { generateInvoiceNo } from '../utils/invoiceHelper.js';
import {
  LAB_TEST_PRICES,
  RADIOLOGY_TEST_PRICES,
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

    // OPD services
    const opdServices = [
      {
        name: 'OPD Consultation',
        department: 'OPD',
        price: getOPDCharge(patientType),
      },
    ];

    // Lab services
    const labServices = Object.keys(LAB_TEST_PRICES).map(testName => ({
      name: testName,
      department: 'Laboratory',
      price: getLabTestPrice(testName, patientType),
    }));

    // Radiology services
    const radiologyServices = Object.keys(RADIOLOGY_TEST_PRICES).map(testName => ({
      name: testName,
      department: 'Radiology',
      price: getRadiologyTestPrice(testName, patientType),
    }));

    // Pharmacy items from inventory
    let pharmacyItems = [];
    try {
      const meds = await Inventory.find({
        category: { $in: ['Medicine', 'pharmacy'] },
        quantity: { $gt: 0 },
      }).select('name price quantity').sort({ name: 1 });

      const medicineFree = isMedicineFree(patientType);
      pharmacyItems = meds.map(m => ({
        name: m.name,
        department: 'Pharmacy',
        price: medicineFree ? 0 : (m.price || 0),
        stock: m.quantity,
      }));
    } catch (invErr) {
      console.warn('⚠️ Could not fetch inventory for pricing:', invErr.message);
    }

    res.json({
      success: true,
      data: {
        patientType,
        opdCharge: getOPDCharge(patientType),
        medicineFree: isMedicineFree(patientType),
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

// ─── Revenue summary for reports ───
router.get('/revenue/summary', verifyToken, checkRole(['billing', 'admin', 'receptionist']), async (req, res) => {
  try {
    const { from, to } = req.query;

    const paidMatch = { paymentStatus: 'paid' };
    if (from || to) {
      paidMatch.updatedAt = {};
      if (from) paidMatch.updatedAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        paidMatch.updatedAt.$lte = toDate;
      }
    }

    const [overall] = await Invoice.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$netAmount' },
          totalCollected: { $sum: '$amountPaid' },
          totalDiscount: { $sum: '$discount' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    const bySource = await Invoice.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: '$source',
          revenue: { $sum: '$netAmount' },
          collected: { $sum: '$amountPaid' },
          count: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const byPatientType = await Invoice.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: '$patientType',
          revenue: { $sum: '$netAmount' },
          collected: { $sum: '$amountPaid' },
          count: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyMatch = { paymentStatus: 'paid' };
    if (from || to) {
      dailyMatch.updatedAt = {};
      if (from) dailyMatch.updatedAt.$gte = new Date(from);
      if (to) {
        const dEnd = new Date(to);
        dEnd.setHours(23, 59, 59, 999);
        dailyMatch.updatedAt.$lte = dEnd;
      }
    } else {
      dailyMatch.updatedAt = { $gte: thirtyDaysAgo };
    }

    const daily = await Invoice.aggregate([
      { $match: dailyMatch },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $ifNull: ['$paidAt', '$updatedAt'] },
            },
          },
          revenue: { $sum: '$netAmount' },
          collected: { $sum: '$amountPaid' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const [pending] = await Invoice.aggregate([
      { $match: { paymentStatus: { $in: ['pending', 'partial'] } } },
      {
        $group: {
          _id: null,
          totalPending: { $sum: { $subtract: ['$netAmount', { $ifNull: ['$amountPaid', 0] }] } },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overall: overall || { totalRevenue: 0, totalCollected: 0, totalDiscount: 0, invoiceCount: 0 },
        bySource,
        byPatientType,
        daily,
        pending: pending || { totalPending: 0, count: 0 },
      },
    });
  } catch (err) {
    console.error('Error generating revenue summary:', err);
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

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Build items with prices as sent by frontend
    const pricedItems = items.map(item => ({
      service: item.service || item.name,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      department: item.department || 'General',
    }));

    const total = pricedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const invoiceNo = await generateInvoiceNo();

    // Accept explicit discount from frontend (default 0)
    const discount = req.body.discount != null ? Number(req.body.discount) : 0;
    const netAmount = Math.max(total - discount, 0);

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
      amountPaid: 0,
      paymentStatus: 'pending',
    });

    await invoice.save();

    res.status(201).json({ 
      success: true, 
      message: 'Invoice created',
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
    if (paymentStatus) {
      invoice.paymentStatus = paymentStatus;
      if (paymentStatus === 'paid') invoice.paidAt = new Date();
    }
    if (paymentMethod) invoice.paymentMethod = paymentMethod;
    if (transactionId) invoice.transactionId = transactionId;
    if (amountPaid != null) {
      invoice.amountPaid = Number(amountPaid);
      // Recalculate balance: if fully paid, mark as paid
      const remaining = invoice.netAmount - invoice.amountPaid;
      if (remaining <= 0 && !paymentStatus) {
        invoice.paymentStatus = 'paid';
        invoice.paidAt = new Date();
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
