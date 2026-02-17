import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Patient from '../models/Patient.js';

const router = express.Router();

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

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const invoiceCount = await Invoice.countDocuments();
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Free for all ASF-affiliated types
    const FREE_TYPES = ['ASF', 'ASF_FAMILY', 'ASF_FOUNDATION', 'ASF_SCHOOL'];
    const isFree = FREE_TYPES.includes(patient.patientType);
    // Accept explicit discount from frontend, or auto-discount for free patients
    const discount = isFree ? total : (req.body.discount != null ? Number(req.body.discount) : 0);
    const netAmount = Math.max(total - discount, 0);

    const invoice = new Invoice({
      invoiceNo,
      patientId,
      patientNo: patient.patientNo,
      patientType: patient.patientType,
      forceNo: patient.forceNo,
      patientName,
      source: req.body.source || 'Manual',
      items,
      total,
      discount,
      netAmount,
      amountPaid: isFree ? netAmount : 0,
      paymentStatus: netAmount === 0 ? 'paid' : 'pending',
    });

    await invoice.save();
    res.status(201).json({ 
      success: true, 
      message: isFree ? 'Invoice created (Free - ASF Staff)' : 'Invoice created',
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
