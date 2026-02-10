import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Department from '../models/Department.js';

const router = express.Router();

// Get all departments
router.get('/', verifyToken, async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    const data = departments.map(d => ({
      id: d._id,
      name: d.name,
      description: d.description,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get department by ID
router.get('/:departmentId', verifyToken, async (req, res) => {
  try {
    const dept = await Department.findById(req.params.departmentId);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: dept._id,
        name: dept.name,
        description: dept.description,
      }
    });
  } catch (err) {
    console.error('Error fetching department:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new department (admin only)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, head } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    // Check if department already exists
    const existingDept = await Department.findOne({ name });
    if (existingDept) {
      return res.status(400).json({ success: false, message: 'Department already exists' });
    }

    const newDept = new Department({
      name,
      description: description || '',
      head: head || 'Not assigned',
    });

    await newDept.save();
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: {
        id: newDept._id,
        name: newDept.name,
        description: newDept.description,
        head: newDept.head,
      },
    });
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update department
router.put('/:departmentId', verifyToken, async (req, res) => {
  try {
    const { name, description, head } = req.body;
    const dept = await Department.findByIdAndUpdate(
      req.params.departmentId,
      { name, description, head },
      { new: true }
    );
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({
      success: true,
      message: 'Department updated',
      data: {
        id: dept._id,
        name: dept.name,
        description: dept.description,
        head: dept.head,
      },
    });
  } catch (err) {
    console.error('Error updating department:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete department
router.delete('/:departmentId', verifyToken, async (req, res) => {
  try {
    const dept = await Department.findByIdAndDelete(req.params.departmentId);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
