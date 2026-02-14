import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import RadiologyRequest from '../models/RadiologyRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import Invoice from '../models/Invoice.js';
import { getRadiologyTestPrice } from '../utils/pricing.js';

const router = express.Router();

// Get all radiology requests
router.get('/', verifyToken, async (req, res) => {
  try {
    const radiologyRequests = await RadiologyRequest.find()
      .populate('patientId', 'firstName lastName mrNo forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    
    const data = radiologyRequests.map(r => ({
      id: r._id,
      requestNo: r.requestNo,
      patientId: r.patientId?._id,
      patient: r.patientId ? `${r.patientId.firstName} ${r.patientId.lastName}` : 'Unknown',
      patientName: r.patientId ? `${r.patientId.firstName} ${r.patientId.lastName}` : 'Unknown',
      mrNo: r.mrNo || r.patientId?.mrNo,
      forceNo: r.forceNo || r.patientId?.forceNo,
      test: r.testType,
      testType: r.testType,
      doctorId: r.doctorId?._id,
      doctor: r.doctorId?.name,
      requestDate: r.requestDate ? new Date(r.requestDate).toLocaleDateString() : '',
      status: r.status,
      report: r.report,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching radiology requests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get radiology request by ID
router.get('/:requestId', verifyToken, async (req, res) => {
  try {
    const request = await RadiologyRequest.findById(req.params.requestId)
      .populate('patientId', 'firstName lastName mrNo forceNo')
      .populate('doctorId', 'name department');
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Radiology request not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: request._id,
        ...request.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching radiology request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get radiology requests for a patient
router.get('/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const requests = await RadiologyRequest.find({ patientId: req.params.patientId })
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Error fetching patient radiology requests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create radiology request (doctor only)
router.post('/', verifyToken, checkRole(['doctor']), async (req, res) => {
  try {
    const { patientId, mrNo, forceNo, testType } = req.body;

    if (!patientId || !testType) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const requestCount = await RadiologyRequest.countDocuments();
    const requestNo = `RAD-${new Date().getFullYear()}-${String(requestCount + 1).padStart(4, '0')}`;

    const newRequest = new RadiologyRequest({
      requestNo,
      patientId,
      mrNo,
      forceNo,
      testType,
      doctorId: req.user.id,
      requestDate: new Date(),
      status: 'pending',
    });

    await newRequest.save();

    // Generate invoice for this radiology test based on patient type
    try {
      const patient = await Patient.findById(patientId);
      if (patient) {
        const patientName = `${patient.firstName} ${patient.lastName}`;
        const testPrice = getRadiologyTestPrice(testType, patient.patientType);
        const isFree = patient.patientType === 'ASF';

        const invoiceCount = await Invoice.countDocuments();
        const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

        const total = testPrice;
        const discount = isFree ? total : 0;
        const netAmount = total - discount;

        const invoice = new Invoice({
          invoiceNo,
          patientId: patient._id,
          patientNo: patient.patientNo,
          patientType: patient.patientType,
          forceNo: patient.forceNo,
          patientName,
          items: [{ service: `X-Ray - ${testType}`, price: testPrice, quantity: 1 }],
          total,
          discount,
          netAmount,
          paymentStatus: isFree ? 'paid' : 'pending',
        });
        await invoice.save();
        console.log('✅ [RADIOLOGY] Invoice created:', invoiceNo, 'for', testType, '| Rs.', testPrice, '| Patient:', patientName);

        // Notify receptionist/billing staff about the invoice
        const receptionists = await User.find({ role: { $in: ['receptionist', 'billing'] } });
        for (const staff of receptionists) {
          await Notification.create({
            userId: staff._id,
            type: 'invoice_created',
            title: 'New Radiology Invoice',
            message: `X-Ray "${testType}" requested for ${patientName} (${patient.patientType}). Invoice ${invoiceNo} - Rs. ${netAmount}${isFree ? ' (Free - ASF Staff)' : ' - payment pending'}.`,
            relatedId: invoice._id,
            relatedType: 'invoice',
            actionUrl: '/receptionist/billing',
          });
        }
        console.log('🔔 [RADIOLOGY] Notified', receptionists.length, 'reception/billing staff');
      }
    } catch (invoiceErr) {
      console.error('⚠️ [RADIOLOGY] Error creating invoice (radiology request still created):', invoiceErr);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Radiology request created', 
      data: {
        id: newRequest._id,
        ...newRequest.toObject(),
      }
    });
  } catch (err) {
    console.error('Error creating radiology request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update radiology request status
router.put('/:requestId', verifyToken, checkRole(['radiologist', 'radiology', 'doctor']), async (req, res) => {
  try {
    const request = await RadiologyRequest.findById(req.params.requestId)
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'name');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Radiology request not found' });
    }

    const previousStatus = request.status;
    const { status, report } = req.body;
    if (status) request.status = status;
    if (report) request.report = report;

    await request.save();

    // Notify doctor when exam is started (in-progress)
    if (status === 'in-progress' && previousStatus === 'pending' && request.doctorId) {
      const patientName = request.patientId ? `${request.patientId.firstName} ${request.patientId.lastName}` : 'Patient';
      try {
        await Notification.create({
          userId: request.doctorId._id || request.doctorId,
          type: 'radiology_request',
          title: 'Radiology Exam Started',
          message: `Radiology exam "${request.testType}" for ${patientName} is now in progress.`,
          relatedId: request._id,
          relatedType: 'radiology_request',
        });
      } catch (notifErr) {
        console.error('Error creating radiology in-progress notification:', notifErr);
      }
    }

    // Notify doctor when report is completed
    if (status === 'completed' && previousStatus !== 'completed' && request.doctorId) {
      const patientName = request.patientId ? `${request.patientId.firstName} ${request.patientId.lastName}` : 'Patient';
      try {
        await Notification.create({
          userId: request.doctorId._id || request.doctorId,
          type: 'radiology_report_completed',
          title: 'Radiology Report Ready',
          message: `Radiology report for "${request.testType}" of ${patientName} is now available.`,
          relatedId: request._id,
          relatedType: 'radiology_request',
        });
      } catch (notifErr) {
        console.error('Error creating radiology completion notification:', notifErr);
      }
    }

    res.json({ 
      success: true, 
      message: 'Radiology request updated', 
      data: {
        id: request._id,
        ...request.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating radiology request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
