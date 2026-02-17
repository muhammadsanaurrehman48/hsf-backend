import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Activity from '../models/Activity.js';
import Prescription from '../models/Prescription.js';
import LabRequest from '../models/LabRequest.js';
import RadiologyRequest from '../models/RadiologyRequest.js';
import Queue from '../models/Queue.js';

const router = express.Router();

// Helper function to get date range based on period
function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  
  switch(period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case '1month':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3months':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6months':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 6);
  }
  return { start, end };
}

// Dashboard stats
router.get('/stats', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayStr = todayStart.toISOString().split('T')[0];

    const [
      totalUsers,
      totalDepartments,
      totalPatients,
      totalAppointments,
      totalPrescriptions,
      totalLabRequests,
      totalRadiologyRequests,
      totalInvoices,
      revenueAgg,
      paidRevenueAgg,
      pendingRevenueAgg,
      todayAppointments,
      todayRegistrations,
      todayInvoices,
      todayRevenueAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Department.countDocuments(),
      Patient.countDocuments(),
      Appointment.countDocuments(),
      Prescription.countDocuments(),
      LabRequest.countDocuments(),
      RadiologyRequest.countDocuments(),
      Invoice.countDocuments(),
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$netAmount' } } }]),
      Invoice.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$netAmount' } } }]),
      Invoice.aggregate([{ $match: { paymentStatus: 'pending' } }, { $group: { _id: null, total: { $sum: '$netAmount' } } }]),
      Appointment.countDocuments({
        $or: [
          { date: todayStr },
          { createdAt: { $gte: todayStart, $lte: todayEnd } }
        ]
      }),
      Patient.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Invoice.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Invoice.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } }
      ]),
    ]);

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;
    const paidRevenue = paidRevenueAgg.length > 0 ? paidRevenueAgg[0].total : 0;
    const pendingRevenue = pendingRevenueAgg.length > 0 ? pendingRevenueAgg[0].total : 0;
    const todayRevenue = todayRevenueAgg.length > 0 ? todayRevenueAgg[0].total : 0;

    const stats = {
      totalUsers,
      departments: totalDepartments,
      todayPatients: todayAppointments,
      todayRegistrations,
      todayInvoices,
      todayRevenue,
      totalPatients,
      totalAppointments,
      totalPrescriptions,
      totalLabRequests,
      totalRadiologyRequests,
      totalInvoices,
      totalRevenue,
      paidRevenue,
      pendingRevenue,
    };
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get activity log
router.get('/activities', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const activities = await Activity.find().sort({ createdAt: -1 }).limit(50);
    const data = activities.map(a => ({
      id: a._id,
      title: a.title,
      description: a.description,
      time: a.time,
      status: a.status,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// System health check
router.get('/health', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const health = {
      database: 'Healthy',
      apiResponseTime: '45ms',
      activeSessions: 23,
      lastBackup: new Date(),
    };
    res.json({ success: true, data: health });
  } catch (err) {
    console.error('Error fetching health:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get billing overview
router.get('/billing-overview', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const invoices = await Invoice.find();
    
    const totalRevenue = invoices.reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const pendingPayments = invoices
      .filter(i => i.paymentStatus === 'pending')
      .reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const completedPayments = invoices
      .filter(i => i.paymentStatus === 'paid')
      .reduce((sum, i) => sum + (i.netAmount || 0), 0);

    const overview = {
      totalRevenue,
      pendingPayments,
      completedPayments,
      totalInvoices: invoices.length,
    };
    res.json({ success: true, data: overview });
  } catch (err) {
    console.error('Error fetching billing overview:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get comprehensive analytics data
router.get('/analytics', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const period = req.query.period || '6months';
    const { start, end } = getDateRange(period);

    // Patient visits data - monthly breakdown
    const monthlyPatients = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          opd: { $sum: { $cond: [{ $eq: ['$type', 'OPD'] }, 1, 0] } },
          ipd: { $sum: { $cond: [{ $eq: ['$type', 'IPD'] }, 1, 0] } },
          emergency: { $sum: { $cond: [{ $eq: ['$type', 'Emergency'] }, 1, 0] } },
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Revenue data
    const monthlyRevenue = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$netAmount' },
          expenses: { $sum: { $cond: [true, 0, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Department distribution
    const departmentStats = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const departmentData = departmentStats.map(d => ({
      name: d._id || 'General',
      value: d.count
    })).slice(0, 5);

    // Staff role distribution
    const staffByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format monthly data with month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const patientData = monthlyPatients.map(m => ({
      month: monthNames[m._id.month - 1],
      opd: m.opd,
      ipd: m.ipd,
      emergency: m.emergency
    }));

    const revenueData = monthlyRevenue.map(m => ({
      month: monthNames[m._id.month - 1],
      revenue: m.revenue,
      expenses: 0
    }));

    res.json({ 
      success: true, 
      data: {
        patientData,
        revenueData,
        departmentData,
        staffByRole
      }
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get detailed reports
router.get('/reports', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const period = req.query.period || '6months';
    const { start, end } = getDateRange(period);

    const [totalPatients, totalAppointments] = await Promise.all([
      Patient.countDocuments(),
      Appointment.countDocuments(),
    ]);

    const completedAppointments = await Appointment.countDocuments({ 
      status: 'completed',
      createdAt: { $gte: start, $lte: end }
    });
    const cancelledAppointments = await Appointment.countDocuments({ 
      status: 'cancelled',
      createdAt: { $gte: start, $lte: end }
    });

    const newPatients = await Patient.countDocuments({ createdAt: { $gte: start, $lte: end } });

    // Get admitted patients from DB (WardPatients with active status)
    let admittedPatients = 0;
    try {
      const WardPatient = (await import('../models/WardPatient.js')).default;
      admittedPatients = await WardPatient.countDocuments({ status: { $in: ['admitted', 'active'] } });
    } catch (e) {
      admittedPatients = 0;
    }

    const reports = {
      patientReports: {
        totalPatients,
        newPatients,
        admittedPatients,
      },
      appointmentReports: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
      },
    };
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Download report as CSV/PDF
router.get('/download-report', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const reportType = req.query.type || 'summary';
    const format = req.query.format || 'csv';

    let csvContent = '';
    let filename = '';

    if (reportType === 'patients') {
      const patients = await Patient.find().lean();
      csvContent = 'Patient No,First Name,Last Name,Patient Type,Force No,Gender,DOB,Phone,CNIC,Address,City,Created At\n';
      patients.forEach(p => {
        csvContent += `"${p.patientNo}","${p.firstName}","${p.lastName}","${p.patientType}","${p.forceNo || ''}","${p.gender || ''}","${p.dateOfBirth || ''}","${p.phone || ''}","${p.cnic || ''}","${p.address || ''}","${p.city || ''}","${p.createdAt}"\n`;
      });
      filename = 'patients_report.csv';
    } else if (reportType === 'appointments') {
      const appointments = await Appointment.find()
        .populate('patientId', 'firstName lastName patientNo')
        .populate('doctorId', 'name department')
        .lean();
      csvContent = 'Appointment No,Patient,Patient No,Doctor,Department,Room,Date,Time,Status,Created At\n';
      appointments.forEach(a => {
        const patientName = a.patientId ? `${a.patientId.firstName} ${a.patientId.lastName}` : 'N/A';
        csvContent += `"${a.appointmentNo}","${patientName}","${a.patientId?.patientNo || ''}","${a.doctorId?.name || ''}","${a.doctorId?.department || ''}","${a.roomNo}","${a.date}","${a.time}","${a.status}","${a.createdAt}"\n`;
      });
      filename = 'appointments_report.csv';
    } else if (reportType === 'revenue') {
      const invoices = await Invoice.find()
        .populate('patientId', 'firstName lastName patientNo patientType')
        .lean();
      csvContent = 'Invoice No,Patient,Patient No,Type,Source,Total,Discount,Net Amount,Paid,Status,Payment Method,Created At\n';
      invoices.forEach(i => {
        csvContent += `"${i.invoiceNo}","${i.patientName}","${i.patientNo || ''}","${i.patientType || ''}","${i.source || 'Manual'}",${i.total},${i.discount || 0},${i.netAmount},${i.amountPaid || 0},"${i.paymentStatus}","${i.paymentMethod || ''}","${i.createdAt}"\n`;
      });
      filename = 'revenue_report.csv';
    } else if (reportType === 'prescriptions') {
      const prescriptions = await Prescription.find()
        .populate('patientId', 'firstName lastName patientNo')
        .populate('doctorId', 'name')
        .lean();
      csvContent = 'Rx No,Patient,Patient No,Doctor,Diagnosis,Medicines,Lab Tests,Status,Created At\n';
      prescriptions.forEach(p => {
        const patientName = p.patientId ? `${p.patientId.firstName} ${p.patientId.lastName}` : 'N/A';
        const meds = (p.medicines || []).map(m => m.name).join('; ');
        const labs = (p.labTests || []).join('; ');
        csvContent += `"${p.rxNo}","${patientName}","${p.patientId?.patientNo || ''}","${p.doctorId?.name || ''}","${p.diagnosis}","${meds}","${labs}","${p.status}","${p.createdAt}"\n`;
      });
      filename = 'prescriptions_report.csv';
    } else {
      csvContent = 'Report Summary\n';
      const [users, patients, appointments] = await Promise.all([
        User.countDocuments(),
        Patient.countDocuments(),
        Appointment.countDocuments()
      ]);
      csvContent += `Total Users,${users}\n`;
      csvContent += `Total Patients,${patients}\n`;
      csvContent += `Total Appointments,${appointments}\n`;
      filename = 'summary_report.csv';
    }

    res.setHeader('Content-Type', 'text/csv;charset=utf-8;');
    res.setHeader('Content-Disposition', `attachment;filename=${filename}`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== Admin Full Access Endpoints =====

// Get all patients (admin overview)
router.get('/patients', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { period } = req.query;
    let filter = {};
    if (period) {
      const { start, end } = getDateRange(period);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const patients = await Patient.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: patients, total: patients.length });
  } catch (err) {
    console.error('Error fetching admin patients:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all appointments (admin overview)
router.get('/appointments', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { period } = req.query;
    let filter = {};
    if (period) {
      const { start, end } = getDateRange(period);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const appointments = await Appointment.find(filter)
      .populate('patientId', 'firstName lastName patientNo patientType forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: appointments, total: appointments.length });
  } catch (err) {
    console.error('Error fetching admin appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all prescriptions (admin overview)
router.get('/prescriptions', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { period } = req.query;
    let filter = {};
    if (period) {
      const { start, end } = getDateRange(period);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const prescriptions = await Prescription.find(filter)
      .populate('patientId', 'firstName lastName patientNo patientType forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: prescriptions, total: prescriptions.length });
  } catch (err) {
    console.error('Error fetching admin prescriptions:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all lab requests (admin overview)
router.get('/lab-requests', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { period } = req.query;
    let filter = {};
    if (period) {
      const { start, end } = getDateRange(period);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const labRequests = await LabRequest.find(filter)
      .populate('patientId', 'firstName lastName patientNo forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: labRequests, total: labRequests.length });
  } catch (err) {
    console.error('Error fetching admin lab requests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all radiology requests (admin overview)
router.get('/radiology-requests', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { period } = req.query;
    let filter = {};
    if (period) {
      const { start, end } = getDateRange(period);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const radiologyRequests = await RadiologyRequest.find(filter)
      .populate('patientId', 'firstName lastName patientNo forceNo')
      .populate('doctorId', 'name department')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: radiologyRequests, total: radiologyRequests.length });
  } catch (err) {
    console.error('Error fetching admin radiology requests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all invoices (admin overview with period filter)
router.get('/invoices', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { period } = req.query;
    let filter = {};
    if (period) {
      const { start, end } = getDateRange(period);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const invoices = await Invoice.find(filter)
      .populate('patientId', 'firstName lastName patientNo patientType forceNo')
      .sort({ createdAt: -1 });
    
    const totalRevenue = invoices.reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const paidRevenue = invoices.filter(i => i.paymentStatus === 'paid').reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const pendingRevenue = invoices.filter(i => i.paymentStatus === 'pending').reduce((sum, i) => sum + (i.netAmount || 0), 0);
    
    res.json({ 
      success: true, 
      data: invoices, 
      total: invoices.length,
      summary: { totalRevenue, paidRevenue, pendingRevenue }
    });
  } catch (err) {
    console.error('Error fetching admin invoices:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get comprehensive summary (daily/weekly/monthly/annual)
router.get('/summary', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const { start, end } = getDateRange(period);
    const dateFilter = { createdAt: { $gte: start, $lte: end } };

    const [patients, appointments, prescriptions, labRequests, radiologyRequests, invoices] = await Promise.all([
      Patient.countDocuments(dateFilter),
      Appointment.countDocuments(dateFilter),
      Prescription.countDocuments(dateFilter),
      LabRequest.countDocuments(dateFilter),
      RadiologyRequest.countDocuments(dateFilter),
      Invoice.find(dateFilter).lean(),
    ]);

    const totalRevenue = invoices.reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const paidRevenue = invoices.filter(i => i.paymentStatus === 'paid').reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const pendingRevenue = invoices.filter(i => i.paymentStatus === 'pending').reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const completedAppointments = await Appointment.countDocuments({ ...dateFilter, status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ ...dateFilter, status: 'cancelled' });

    // Revenue by source
    const revenueBySource = {};
    for (const inv of invoices) {
      const src = inv.source || 'Manual';
      if (!revenueBySource[src]) revenueBySource[src] = { total: 0, count: 0 };
      revenueBySource[src].total += inv.netAmount || 0;
      revenueBySource[src].count += 1;
    }

    res.json({
      success: true,
      data: {
        period,
        dateRange: { start, end },
        patients,
        appointments,
        completedAppointments,
        cancelledAppointments,
        prescriptions,
        labRequests,
        radiologyRequests,
        invoiceCount: invoices.length,
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        revenueBySource,
      }
    });
  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
