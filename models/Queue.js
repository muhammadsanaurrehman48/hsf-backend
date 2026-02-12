import mongoose from 'mongoose';

const queuePatientSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  },
  tokenNo: String,
  patientNo: String,
  patientName: String,
  forceNo: String,
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  },
  status: {
    type: String,
    enum: ['waiting', 'vitals_recorded', 'serving', 'completed', 'skipped'],
    default: 'waiting',
  },
  position: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const queueSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roomNo: {
      type: String,
      required: true,
      unique: true,
    },
    doctorName: {
      type: String,
    },
    department: {
      type: String,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    currentToken: {
      type: String,
    },
    currentPatientIndex: {
      type: Number,
      default: 0,
    },
    patients: [queuePatientSchema],
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'closed'],
      default: 'active',
    },
  },
  { timestamps: true }
);

const Queue = mongoose.model('Queue', queueSchema);
export default Queue;
