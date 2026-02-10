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
      enum: ['general', 'pharmacy'],
      default: 'general',
    },
    strength: {
      type: String,
    },
  },
  { timestamps: true }
);

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;
