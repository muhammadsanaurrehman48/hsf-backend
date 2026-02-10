import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  service: String,
  price: Number,
  quantity: Number,
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    patientNo: {
      type: String,
    },
    patientType: {
      type: String,
      enum: ['ASF', 'ASF_FAMILY', 'CIVILIAN'],
    },
    forceNo: {
      type: String,
    },
    patientName: {
      type: String,
      required: true,
    },
    items: [invoiceItemSchema],
    total: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'auto-paid'],
      default: 'pending',
    },
    autoPayment: {
      type: Boolean,
      default: false,
    },
    paymentMethod: {
      type: String,
    },
    transactionId: {
      type: String,
    },
  },
  { timestamps: true }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
