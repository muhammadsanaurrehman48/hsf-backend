import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import LabRequest from '../models/LabRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import Invoice from '../models/Invoice.js';
import { getLabTestPrice } from '../utils/pricing.js';

const router = express.Router();

// Get all lab requests
router.get('/', verifyToken, async (req, res) => {
  try {
    const labRequests = await LabRequest.find()
      .populate('patientId', 'firstName lastName mrNo forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    
    const data = labRequests.map(r => ({
      id: r._id,
      requestNo: r.requestNo,
      patientId: r.patientId?._id,
      patient: r.patientId ? `${r.patientId.firstName} ${r.patientId.lastName}` : 'Unknown',
      patientName: r.patientId ? `${r.patientId.firstName} ${r.patientId.lastName}` : 'Unknown',
      mrNo: r.mrNo || r.patientId?.mrNo,
      forceNo: r.forceNo || r.patientId?.forceNo,
      test: r.test,
      doctorId: r.doctorId?._id,
      doctor: r.doctorId?.name,
      requestDate: r.requestDate ? new Date(r.requestDate).toLocaleDateString() : '',
      status: r.status,
      result: r.result,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching lab requests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get lab request by ID
router.get('/:requestId', verifyToken, async (req, res) => {
  try {
    const request = await LabRequest.findById(req.params.requestId)
      .populate('patientId', 'firstName lastName mrNo forceNo')
      .populate('doctorId', 'name department');
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Lab request not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: request._id,
        ...request.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching lab request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get lab requests for a patient
router.get('/patient/:patientId', verifyToken, async (req, res) => {
  try {
    const requests = await LabRequest.find({ patientId: req.params.patientId })
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Error fetching patient lab requests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create lab request (doctor only)
router.post('/', verifyToken, checkRole(['doctor']), async (req, res) => {
  try {
    const { patientId, mrNo, forceNo, test } = req.body;

    if (!patientId || !test) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const requestCount = await LabRequest.countDocuments();
    const requestNo = `LAB-${new Date().getFullYear()}-${String(requestCount + 123).padStart(4, '0')}`;

    const newRequest = new LabRequest({
      requestNo,
      patientId,
      mrNo,
      forceNo,
      test,
      doctorId: req.user.id,
      requestDate: new Date(),
      status: 'pending',
    });

    await newRequest.save();

    // Generate invoice for this lab test based on patient type
    try {
      const patient = await Patient.findById(patientId);
      if (patient) {
        const patientName = `${patient.firstName} ${patient.lastName}`;
        const testPrice = getLabTestPrice(test, patient.patientType);

        const invoiceCount = await Invoice.countDocuments();
        const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

        const total = testPrice;
        // Free for all ASF-affiliated types
        const FREE_TYPES = ['ASF', 'ASF_FAMILY', 'ASF_FOUNDATION', 'ASF_SCHOOL'];
        const isFree = FREE_TYPES.includes(patient.patientType);
        const discount = isFree ? total : 0;
        const netAmount = Math.max(total - discount, 0);

        const invoice = new Invoice({
          invoiceNo,
          patientId: patient._id,
          patientNo: patient.patientNo,
          patientType: patient.patientType,
          forceNo: patient.forceNo,
          patientName,
          source: 'Laboratory',
          items: [{ service: `Lab Test - ${test}`, price: testPrice, quantity: 1 }],
          total,
          discount,
          netAmount,
          amountPaid: isFree ? 0 : 0,
          paymentStatus: netAmount === 0 ? 'paid' : 'pending',
        });
        await invoice.save();
        console.log('✅ [LAB] Invoice created:', invoiceNo, 'for', test, '| Rs.', testPrice, '| Patient:', patientName);

        // Notify receptionist/billing staff about the invoice
        const receptionists = await User.find({ role: { $in: ['receptionist', 'billing'] } });
        for (const staff of receptionists) {
          await Notification.create({
            userId: staff._id,
            type: 'invoice_created',
            title: 'New Lab Test Invoice',
            message: `Lab test "${test}" requested for ${patientName} (${patient.patientType}). Invoice ${invoiceNo} - Rs. ${netAmount} - payment pending.`,
            relatedId: invoice._id,
            relatedType: 'invoice',
            actionUrl: '/receptionist/billing',
          });
        }
        console.log('🔔 [LAB] Notified', receptionists.length, 'reception/billing staff');
      }
    } catch (invoiceErr) {
      console.error('⚠️ [LAB] Error creating invoice (lab request still created):', invoiceErr);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Lab request created', 
      data: {
        id: newRequest._id,
        ...newRequest.toObject(),
      }
    });
  } catch (err) {
    console.error('Error creating lab request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update lab request status
router.put('/:requestId', verifyToken, checkRole(['laboratory', 'lab_technician', 'doctor']), async (req, res) => {
  try {
    const request = await LabRequest.findById(req.params.requestId)
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'name');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Lab request not found' });
    }

    const { status, result } = req.body;
    const previousStatus = request.status;
    if (status) request.status = status;
    if (result !== undefined) request.result = result;

    await request.save();

    const patientName = request.patientId ? `${request.patientId.firstName} ${request.patientId.lastName}` : 'Patient';

    // Notify doctor when result is completed
    if (status === 'completed' && request.doctorId) {
      await Notification.create({
        userId: request.doctorId._id || request.doctorId,
        type: 'lab_result_completed',
        title: 'Lab Results Ready',
        message: `Lab results for ${patientName} - ${request.test} (${request.requestNo}) are ready.`,
        relatedId: request._id,
        relatedType: 'lab_request',
        actionUrl: '/doctor/lab-requests',
      });
      console.log('🔔 [LAB] Notified doctor about completed result:', request.requestNo);
    }

    // Notify doctor when sample is collected (status changes)
    if (status === 'sample-collected' && previousStatus === 'pending' && request.doctorId) {
      await Notification.create({
        userId: request.doctorId._id || request.doctorId,
        type: 'lab_request',
        title: 'Sample Collected',
        message: `Sample collected for ${patientName} - ${request.test} (${request.requestNo}). Processing started.`,
        relatedId: request._id,
        relatedType: 'lab_request',
        actionUrl: '/doctor/lab-requests',
      });
    }

    res.json({ 
      success: true, 
      message: 'Lab request updated', 
      data: {
        id: request._id,
        ...request.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating lab request:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
