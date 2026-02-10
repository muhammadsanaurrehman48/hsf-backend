import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  name: String,
  dosage: String,
  frequency: String,
  duration: String,
  instructions: String,
});

const prescriptionSchema = new mongoose.Schema(
  {
    rxNo: {
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
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    diagnosis: {
      type: String,
      required: true,
    },
    medicines: [medicineSchema],
    labTests: [String],
    radiologyTests: [String],
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'dispensed', 'completed'],
      default: 'pending',
    },
    dispensedAt: Date,
    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const Prescription = mongoose.model('Prescription', prescriptionSchema);
export default Prescription;
