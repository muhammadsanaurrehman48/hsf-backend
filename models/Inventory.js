import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
    },
    minStock: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      enum: ['Medicine', 'Equipment', 'Consumables', 'Surgical', 'Lab Supplies', 'Radiology', 'general', 'pharmacy'],
      default: 'general',
    },
    strength: {
      type: String,
    },
    // New fields for complete stock tracking
    batchNo: {
      type: String,
    },
    expiryDate: {
      type: Date,
    },
    supplier: {
      type: String,
    },
    department: {
      type: String,
      enum: ['General', 'Pharmacy', 'Laboratory', 'OT', 'Emergency', 'All'],
      default: 'General',
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'expired'],
      default: 'in-stock',
    },
    disposalStatus: {
      type: String,
      enum: ['active', 'marked-for-disposal', 'disposed'],
      default: 'active',
    },
    disposalDate: {
      type: Date,
    },
    disposalReason: {
      type: String,
    },
  },
  { timestamps: true }
);

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;
