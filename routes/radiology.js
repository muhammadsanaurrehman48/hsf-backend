import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import RadiologyRequest from '../models/RadiologyRequest.js';

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
      mrNo: r.mrNo || r.patientId?.mrNo,
      forceNo: r.forceNo || r.patientId?.forceNo,
      testType: r.testType,
      doctorId: r.doctorId?._id,
      doctor: r.doctorId?.name,
      requestDate: r.requestDate,
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
    const requestNo = `RAD-2025-${String(requestCount + 1).padStart(4, '0')}`;

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
router.put('/:requestId', verifyToken, checkRole(['radiologist', 'doctor']), async (req, res) => {
  try {
    const request = await RadiologyRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Radiology request not found' });
    }

    const { status, report } = req.body;
    if (status) request.status = status;
    if (report) request.report = report;

    await request.save();
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
