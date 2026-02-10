import express from 'express';
import { verifyToken, checkRole } from '../middleware/auth.js';
import Inventory from '../models/Inventory.js';

const router = express.Router();

// Get all inventory items
router.get('/', verifyToken, checkRole(['inventory', 'admin']), async (req, res) => {
  try {
    const items = await Inventory.find({ category: 'general' }).sort({ name: 1 });
    const data = items.map(i => ({
      id: i._id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      minStock: i.minStock,
      price: i.price,
    }));
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
    const { name, quantity, unit, minStock, price } = req.body;

    if (!name || !quantity || !unit) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const newItem = new Inventory({
      name,
      quantity,
      unit,
      minStock: minStock || 0,
      price: price || 0,
      category: 'general',
    });

    await newItem.save();
    res.status(201).json({ 
      success: true, 
      message: 'Item added', 
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

    const { quantity, minStock, price, name } = req.body;
    if (quantity !== undefined) item.quantity = quantity;
    if (minStock !== undefined) item.minStock = minStock;
    if (price !== undefined) item.price = price;
    if (name) item.name = name;

    await item.save();
    res.json({ 
      success: true, 
      message: 'Item updated', 
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
    const items = await Inventory.find({ category: 'general' });
    const lowStockItems = items.filter(i => i.quantity <= i.minStock);
    res.json({ success: true, data: lowStockItems });
  } catch (err) {
    console.error('Error fetching low stock items:', err);
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
