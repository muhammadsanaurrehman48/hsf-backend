import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Inventory from '../models/Inventory.js';

const router = express.Router();

// Get all inventory items
router.get('/', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
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
router.get('/low-stock/list', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
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
