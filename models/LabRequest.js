import mongoose from 'mongoose';

const labRequestSchema = new mongoose.Schema(
  {
    requestNo: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    mrNo: {
      type: String,
    },
    forceNo: {
      type: String,
    },
    test: {
      type: String,
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'sample-collected', 'in-progress', 'completed'],
      default: 'pending',
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

const LabRequest = mongoose.model('LabRequest', labRequestSchema);
export default LabRequest;
