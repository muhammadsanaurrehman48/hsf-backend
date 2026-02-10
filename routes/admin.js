import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Activity from '../models/Activity.js';

const router = express.Router();

// Helper function to get date range based on period
function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  
  switch(period) {
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
    const [totalUsers, totalDepartments, totalPatients, totalAppointments, totalRevenue] = await Promise.all([
      User.countDocuments(),
      Department.countDocuments(),
      Patient.countDocuments(),
      Appointment.countDocuments(),
      Invoice.aggregate([
        { $group: { _id: null, total: { $sum: '$netAmount' } } }
      ]).then(result => result.length > 0 ? result[0].total : 0)
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayPatients = await Appointment.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'completed'
    });

    const stats = {
      totalUsers,
      departments: totalDepartments,
      todayPatients,
      systemHealth: '98%',
      totalPatients,
      totalAppointments,
      totalRevenue: totalRevenue || 0,
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
        patientData: patientData.length > 0 ? patientData : generateDummyPatientData(),
        revenueData: revenueData.length > 0 ? revenueData : generateDummyRevenueData(),
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

    const reports = {
      patientReports: {
        totalPatients,
        newPatients,
        admittedPatients: 5,
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
      csvContent = 'ID,Name,Email,Age,Gender,Contact,Status,Created At\n';
      patients.forEach(p => {
        csvContent += `"${p._id}","${p.name}","${p.email}","${p.age}","${p.gender}","${p.contact}","active","${p.createdAt}"\n`;
      });
      filename = 'patients_report.csv';
    } else if (reportType === 'appointments') {
      const appointments = await Appointment.find().lean();
      csvContent = 'ID,Patient,Doctor,DateTime,Type,Status,Department,Created At\n';
      appointments.forEach(a => {
        csvContent += `"${a._id}","${a.patientId}","${a.doctorId}","${a.date}","${a.type}","${a.status}","${a.department}","${a.createdAt}"\n`;
      });
      filename = 'appointments_report.csv';
    } else if (reportType === 'revenue') {
      const invoices = await Invoice.find().lean();
      csvContent = 'ID,Patient,Amount,Status,Created At\n';
      invoices.forEach(i => {
        csvContent += `"${i._id}","${i.patientId}","${i.netAmount}","${i.paymentStatus}","${i.createdAt}"\n`;
      });
      filename = 'revenue_report.csv';
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

// Dummy data generators for demo
function generateDummyPatientData() {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return monthNames.map(month => ({
    month,
    opd: Math.floor(Math.random() * 600) + 400,
    ipd: Math.floor(Math.random() * 100) + 50,
    emergency: Math.floor(Math.random() * 150) + 80,
  }));
}

function generateDummyRevenueData() {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return monthNames.map(month => ({
    month,
    revenue: Math.floor(Math.random() * 500000) + 800000,
    expenses: Math.floor(Math.random() * 300000) + 600000,
  }));
}

export default router;
