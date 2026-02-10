import mongoose from 'mongoose';

const vitalsSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    nurseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bloodPressure: {
      type: String,
    },
    pulse: {
      type: Number,
    },
    temperature: {
      type: Number,
    },
    spo2: {
      type: Number,
    },
    respiratoryRate: {
      type: Number,
    },
    notes: {
      type: String,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const Vitals = mongoose.model('Vitals', vitalsSchema);
export default Vitals;
