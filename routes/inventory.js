import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Inventory from '../models/Inventory.js';

const router = express.Router();

// Get all inventory items
router.get('/', verifyToken, checkRole(['inventory', 'admin', 'doctor', 'pharmacist', 'pharmacy']), async (req, res) => {
  try {
    const items = await Inventory.find().sort({ name: 1 });
    const data = items.map(i => {
      const itemObj = i.toObject();
      return {
        id: i._id,
        ...itemObj,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get available medicines (for doctors & pharmacy)
// Only returns items with quantity > 0 in Medicine category
router.get('/medicines/available', verifyToken, checkRole(['doctor', 'pharmacist', 'pharmacy', 'admin', 'nurse']), async (req, res) => {
  try {
    const medicines = await Inventory.find({
      $or: [
        { category: 'Medicine', quantity: { $gt: 0 } },
        { category: 'pharmacy', quantity: { $gt: 0 } },
      ]
    }).sort({ name: 1 });
    
    const data = medicines.map(m => ({
      id: m._id,
      name: m.name,
      quantity: m.quantity,
      strength: m.strength,
      unit: m.unit,
      price: m.price,
    }));
    
    console.log('✅ [BACKEND] Fetched', data.length, 'available medicines for doctor/pharmacy');
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching available medicines:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get available lab/radiology tests (for doctors)
// Returns items with quantity > 0 in test-related categories
router.get('/tests/available', verifyToken, checkRole(['doctor', 'admin']), async (req, res) => {
  try {
    const tests = await Inventory.find({
      $or: [
        { category: 'Lab Supplies', quantity: { $gt: 0 } },
        { category: 'Lab', quantity: { $gt: 0 } },
      ]
    }).sort({ name: 1 });
    
    const data = tests.map(t => ({
      id: t._id,
      name: t.name,
      category: t.category,
      quantity: t.quantity,
      unit: t.unit,
    }));
    
    console.log('✅ [BACKEND] Fetched', data.length, 'available tests for doctor');
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching available tests:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get inventory item by ID
router.get('/:itemId', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ 
      success: true, 
      data: {
        id: item._id,
        ...item.toObject(),
      }
    });
  } catch (err) {
    console.error('Error fetching inventory item:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add inventory item
router.post('/', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const { name, quantity, unit, minStock, price, category, batchNo, expiryDate, supplier, department } = req.body;

    if (!name || !quantity || !unit) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Determine status based on quantity
    let status = 'in-stock';
    if (quantity === 0) {
      status = 'out-of-stock';
    } else if (quantity <= minStock) {
      status = 'low-stock';
    }

    // Check if item with same batch already exists
    let newItem;
    if (batchNo) {
      const existingBatch = await Inventory.findOne({ name, batchNo });
      if (existingBatch) {
        // Update existing batch quantity
        existingBatch.quantity += parseInt(quantity);
        await existingBatch.save();
        return res.status(201).json({ 
          success: true, 
          message: 'Batch quantity updated', 
          data: {
            id: existingBatch._id,
            ...existingBatch.toObject(),
          }
        });
      }
    }

    newItem = new Inventory({
      name,
      quantity: parseInt(quantity),
      unit,
      minStock: minStock || 0,
      price: price || 0,
      category: category || 'general',
      batchNo,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      supplier,
      department: department || 'General',
      status,
    });

    await newItem.save();
    res.status(201).json({ 
      success: true, 
      message: 'Item added successfully', 
      data: {
        id: newItem._id,
        ...newItem.toObject(),
      }
    });
  } catch (err) {
    console.error('Error adding inventory item:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update inventory
router.put('/:itemId', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const { quantity, minStock, price, name, category, batchNo, expiryDate, supplier, department } = req.body;
    
    if (quantity !== undefined) {
      item.quantity = parseInt(quantity);
      // Update status based on quantity
      if (quantity === 0) {
        item.status = 'out-of-stock';
      } else if (quantity <= (minStock || item.minStock)) {
        item.status = 'low-stock';
      } else {
        item.status = 'in-stock';
      }
    }
    if (minStock !== undefined) item.minStock = minStock;
    if (price !== undefined) item.price = price;
    if (name) item.name = name;
    if (category) item.category = category;
    if (batchNo) item.batchNo = batchNo;
    if (expiryDate) item.expiryDate = new Date(expiryDate);
    if (supplier) item.supplier = supplier;
    if (department) item.department = department;

    await item.save();
    res.json({ 
      success: true, 
      message: 'Item updated successfully', 
      data: {
        id: item._id,
        ...item.toObject(),
      }
    });
  } catch (err) {
    console.error('Error updating inventory item:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get low stock items
router.get('/low-stock/list', verifyToken, checkRole(['inventory', 'admin', 'pharmacy', 'pharmacist']), async (req, res) => {
  try {
    const items = await Inventory.find();
    const lowStockItems = items.filter(i => i.quantity <= i.minStock);
    res.json({ success: true, data: lowStockItems });
  } catch (err) {
    console.error('Error fetching low stock items:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get items by category
router.get('/category/:category', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find({ category: req.params.category }).sort({ name: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Error fetching items by category:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get items by department
router.get('/department/:department', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find({ department: req.params.department }).sort({ name: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Error fetching items by department:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get stock alerts (low stock items)
router.get('/alerts/low-stock', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find({ disposalStatus: 'active' });
    const lowStockItems = items.filter(i => i.quantity <= i.minStock);
    res.json({ success: true, data: lowStockItems });
  } catch (err) {
    console.error('Error fetching low stock alerts:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get expiring items alerts
router.get('/alerts/expiring', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find({ disposalStatus: 'active', expiryDate: { $exists: true, $ne: null } });
    const today = new Date();
    const expiringItems = items.filter(item => {
      const expiryDate = new Date(item.expiryDate);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 90; // Items expiring within 90 days
    });
    res.json({ success: true, data: expiringItems });
  } catch (err) {
    console.error('Error fetching expiring items alerts:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get summary statistics for alerts
router.get('/alerts/summary', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find();
    const today = new Date();
    
    const lowStockItems = items.filter(i => i.quantity <= i.minStock && i.disposalStatus === 'active');
    const expiredItems = items.filter(i => i.expiryDate && new Date(i.expiryDate) < today && i.disposalStatus === 'active');
    const expiringItems = items.filter(i => {
      if (!i.expiryDate || i.disposalStatus !== 'active') return false;
      const daysLeft = Math.floor((new Date(i.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 30 && daysLeft > 0;
    });
    const outOfStock = items.filter(i => i.quantity === 0 && i.disposalStatus === 'active');
    
    res.json({ 
      success: true, 
      data: {
        lowStockCount: lowStockItems.length,
        expiredCount: expiredItems.length,
        expiringCount: expiringItems.length,
        outOfStockCount: outOfStock.length,
      }
    });
  } catch (err) {
    console.error('Error fetching alerts summary:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark item for disposal
router.patch('/mark-disposal/:itemId', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const { reason } = req.body;
    const item = await Inventory.findById(req.params.itemId);
    
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    item.disposalStatus = 'marked-for-disposal';
    item.disposalDate = new Date();
    item.disposalReason = reason || 'Marked for disposal';
    
    await item.save();
    
    res.json({ 
      success: true, 
      message: 'Item marked for disposal',
      data: {
        id: item._id,
        ...item.toObject(),
      }
    });
  } catch (err) {
    console.error('Error marking item for disposal:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get inventory reports data
router.get('/report/analytics', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find({ disposalStatus: 'active' });
    
    // Calculate total items and stock value
    let totalItems = items.length;
    let totalValue = 0;
    const categoryMap = {};
    
    items.forEach(item => {
      totalValue += (item.quantity * item.price) || 0;
      
      const category = item.category || 'Uncategorized';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          items: 0,
          value: 0,
          quantity: 0
        };
      }
      categoryMap[category].items += 1;
      categoryMap[category].value += (item.quantity * item.price) || 0;
      categoryMap[category].quantity += item.quantity;
    });
    
    const itemsByCategory = Object.values(categoryMap).sort((a, b) => b.value - a.value);
    
    res.json({ 
      success: true, 
      data: {
        totalItems,
        totalValue,
        itemsByCategory,
      }
    });
  } catch (err) {
    console.error('Error fetching reports data:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete inventory item
router.delete('/:itemId', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
