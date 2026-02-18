import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Prescription from '../models/Prescription.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import LabRequest from '../models/LabRequest.js';
import RadiologyRequest from '../models/RadiologyRequest.js';
import Invoice from '../models/Invoice.js';
import { getLabTestPrice, getRadiologyTestPrice } from '../utils/pricing.js';
import { generateInvoiceNo } from '../utils/invoiceHelper.js';

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
router.post('/', verifyToken, checkRole(['doctor', 'admin']), async (req, res) => {
  try {
    const {
      patientId,
      appointmentId,
      mrNo,
      forceNo,
      diagnosis,
      medicines,
      labTests,
      radiologyTests,
      notes,
    } = req.body;

    console.log('📝 [BACKEND] Creating prescription for patient:', patientId, '| appointment:', appointmentId);

    if (!patientId || !diagnosis) {
      console.error('❌ [BACKEND] Missing required fields. patientId:', patientId, '| diagnosis:', diagnosis);
      return res.status(400).json({ success: false, message: 'Patient ID and diagnosis are required' });
    }

    // Prevent duplicate prescriptions for the same appointment
    if (appointmentId) {
      const existingRx = await Prescription.findOne({ appointmentId });
      if (existingRx) {
        console.log('⚠️ [BACKEND] Prescription already exists for appointment:', appointmentId, '→ returning existing:', existingRx.rxNo);
        return res.status(201).json({
          success: true,
          message: 'Prescription already exists for this appointment',
          data: {
            id: existingRx._id,
            ...existingRx.toObject(),
          }
        });
      }
    }

    const prescriptionCount = await Prescription.countDocuments();
    const rxNo = `RX-${String(prescriptionCount + 456789).padStart(6, '0')}`;

    const hasMedicines = Array.isArray(medicines) && medicines.length > 0;
    const hasLabTests = Array.isArray(labTests) && labTests.length > 0;
    const hasRadiologyTests = Array.isArray(radiologyTests) && radiologyTests.length > 0;
    const initialStatus = hasMedicines || hasLabTests || hasRadiologyTests ? 'pending' : 'completed';

    const newPrescription = new Prescription({
      rxNo,
      patientId,
      appointmentId: appointmentId || undefined,
      mrNo,
      forceNo,
      doctorId: req.user.id,
      diagnosis,
      medicines: medicines || [],
      labTests: labTests || [],
      radiologyTests: radiologyTests || [],
      notes,
      status: initialStatus,
    });

    await newPrescription.save();
    console.log('✅ [BACKEND] Prescription created:', rxNo);

    // Get patient and doctor info for notifications
    const patient = await Patient.findById(patientId);
    const doctor = await User.findById(req.user.id);
    
    // Send notification to lab staff if lab tests requested + create LabRequest documents
    if (labTests && labTests.length > 0) {
      // Create individual LabRequest documents for each test
      const labRequestDocs = [];
      for (const testName of labTests) {
        const labCount = await LabRequest.countDocuments();
        const requestNo = `LAB-${new Date().getFullYear()}-${String(labCount + 1).padStart(4, '0')}`;
        const labReq = await LabRequest.create({
          requestNo,
          patientId,
          mrNo: mrNo || patient?.mrNo,
          forceNo: forceNo || patient?.forceNo,
          test: testName,
          doctorId: req.user.id,
          requestDate: new Date(),
          status: 'pending',
        });
        labRequestDocs.push(labReq);
        console.log('📋 [BACKEND] LabRequest created:', requestNo, '-', testName);
      }

      const labStaff = await User.find({ role: 'laboratory' });
      console.log('🔔 [BACKEND] Notifying', labStaff.length, 'lab staff about new lab requests');
      
      for (const staff of labStaff) {
        await Notification.create({
          userId: staff._id,
          type: 'lab_request_created',
          title: 'New Lab Request',
          message: `Dr. ${doctor?.name} requested lab tests for ${patient?.firstName} ${patient?.lastName}: ${labTests.join(', ')}`,
          relatedId: newPrescription._id,
          relatedType: 'lab_request',
          actionUrl: `/laboratory/requests`,
        });
      }
      console.log('✅ [BACKEND] Lab notifications created');

      // Create invoices for lab tests and notify receptionist
      if (patient) {
        const patientName = `${patient.firstName} ${patient.lastName}`;

        for (const labReq of labRequestDocs) {
          try {
            const testPrice = getLabTestPrice(labReq.test, patient.patientType);
            const invoiceNo = await generateInvoiceNo();

            const invoice = new Invoice({
              invoiceNo,
              patientId: patient._id,
              patientNo: patient.patientNo,
              patientType: patient.patientType,
              forceNo: patient.forceNo,
              patientName,
              source: 'Laboratory',
              items: [{ service: `Lab Test - ${labReq.test}`, department: 'Laboratory', price: testPrice, quantity: 1 }],
              total: testPrice,
              discount: 0,
              netAmount: testPrice,
              amountPaid: 0,
              paymentStatus: 'pending',
            });
            await invoice.save();
            console.log('✅ [PRESCRIPTION] Lab invoice created:', invoiceNo, 'for', labReq.test, '| Rs.', testPrice);

            // Notify receptionist/billing staff
            const receptionists = await User.find({ role: { $in: ['receptionist', 'billing'] } });
            for (const staff of receptionists) {
              await Notification.create({
                userId: staff._id,
                type: 'invoice_created',
                title: 'New Lab Test Invoice',
                message: `Lab test "${labReq.test}" requested by Dr. ${doctor?.name} for ${patientName} (${patient.patientType}). Invoice ${invoiceNo} - Rs. ${testPrice} - payment pending.`,
                relatedId: invoice._id,
                relatedType: 'invoice',
                actionUrl: '/receptionist/billing',
              });
            }
            console.log('🔔 [PRESCRIPTION] Notified', receptionists.length, 'receptionist/billing staff about lab invoice');
          } catch (invoiceErr) {
            console.error('⚠️ [PRESCRIPTION] Error creating lab invoice:', invoiceErr);
          }
        }
      }
    }

    // Send notification to radiology staff if radiology tests requested + create RadiologyRequest documents
    if (radiologyTests && radiologyTests.length > 0) {
      // Create individual RadiologyRequest documents for each test
      for (const testName of radiologyTests) {
        const radCount = await RadiologyRequest.countDocuments();
        const requestNo = `RAD-${new Date().getFullYear()}-${String(radCount + 1).padStart(4, '0')}`;
        await RadiologyRequest.create({
          requestNo,
          patientId,
          mrNo: mrNo || patient?.mrNo,
          forceNo: forceNo || patient?.forceNo,
          testType: testName,
          doctorId: req.user.id,
          requestDate: new Date(),
          status: 'pending',
        });
        console.log('📋 [BACKEND] RadiologyRequest created:', requestNo, '-', testName);
      }

      const radiologyStaff = await User.find({ role: 'radiologist' });
      console.log('🔔 [BACKEND] Notifying', radiologyStaff.length, 'radiology staff about new radiology requests');
      
      for (const staff of radiologyStaff) {
        await Notification.create({
          userId: staff._id,
          type: 'radiology_request_created',
          title: 'New Radiology Request',
          message: `Dr. ${doctor?.name} requested imaging for ${patient?.firstName} ${patient?.lastName}: ${radiologyTests.join(', ')}`,
          relatedId: newPrescription._id,
          relatedType: 'radiology_request',
          actionUrl: `/radiologist/requests`,
        });
      }
      console.log('✅ [BACKEND] Radiology notifications created');

      // Create invoices for radiology tests and notify receptionist
      if (patient) {
        const patientName = `${patient.firstName} ${patient.lastName}`;

        for (const testName of radiologyTests) {
          try {
            const testPrice = getRadiologyTestPrice(testName, patient.patientType);
            const invoiceNo = await generateInvoiceNo();

            const invoice = new Invoice({
              invoiceNo,
              patientId: patient._id,
              patientNo: patient.patientNo,
              patientType: patient.patientType,
              forceNo: patient.forceNo,
              patientName,
              source: 'Radiology',
              items: [{ service: `X-Ray - ${testName}`, department: 'Radiology', price: testPrice, quantity: 1 }],
              total: testPrice,
              discount: 0,
              netAmount: testPrice,
              amountPaid: 0,
              paymentStatus: 'pending',
            });
            await invoice.save();
            console.log('✅ [PRESCRIPTION] Radiology invoice created:', invoiceNo, 'for', testName, '| Rs.', testPrice);

            // Notify receptionist/billing staff
            const receptionists = await User.find({ role: { $in: ['receptionist', 'billing'] } });
            for (const staff of receptionists) {
              await Notification.create({
                userId: staff._id,
                type: 'invoice_created',
                title: 'New Radiology Invoice',
                message: `X-Ray "${testName}" requested by Dr. ${doctor?.name} for ${patientName} (${patient.patientType}). Invoice ${invoiceNo} - Rs. ${testPrice} - payment pending.`,
                relatedId: invoice._id,
                relatedType: 'invoice',
                actionUrl: '/receptionist/billing',
              });
            }
            console.log('🔔 [PRESCRIPTION] Notified', receptionists.length, 'receptionist/billing staff about radiology invoice');
          } catch (invoiceErr) {
            console.error('⚠️ [PRESCRIPTION] Error creating radiology invoice:', invoiceErr);
          }
        }
      }
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
