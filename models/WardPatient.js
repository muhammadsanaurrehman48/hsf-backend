import mongoose from 'mongoose';

const wardPatientSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    patientNo: {
      type: String,
      required: true,
    },
    ward: {
      type: String,
      required: true,
    },
    bed: {
      type: String,
      required: true,
    },
    admitDate: {
      type: Date,
      default: Date.now,
    },
    doctor: {
      type: String,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['admitted', 'discharged'],
      default: 'admitted',
    },
  },
  { timestamps: true }
);

const WardPatient = mongoose.model('WardPatient', wardPatientSchema);
export default WardPatient;
