import mongoose from 'mongoose';

const radiologyRequestSchema = new mongoose.Schema(
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
    testType: {
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
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
    },
    report: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

const RadiologyRequest = mongoose.model('RadiologyRequest', radiologyRequestSchema);
export default RadiologyRequest;
