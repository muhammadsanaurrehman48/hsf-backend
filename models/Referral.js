import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referralNo: {
    type: String,
    required: true,
    unique: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  },
  patientName: {
    type: String,
    required: true,
  },
  forceNo: {
    type: String,
    default: '',
  },
  patientAge: {
    type: Number,
  },
  patientGender: {
    type: String,
    enum: ['male', 'female', 'Male', 'Female'],
  },
  patientPhone: {
    type: String,
  },
  referredTo: {
    type: String,
    required: true,
  },
  referredDoctor: {
    type: String,
  },
  referringDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  referringDoctorName: {
    type: String,
  },
  diagnosis: {
    type: String,
    required: true,
  },
  reasonForReferral: {
    type: String,
  },
  clinicalHistory: {
    type: String,
  },
  treatmentGiven: {
    type: String,
  },
  investigationsDone: [{
    type: String,
  }],
  urgency: {
    type: String,
    enum: ['routine', 'urgent', 'emergency'],
    default: 'routine',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'transferred', 'completed', 'cancelled'],
    default: 'pending',
  },
  notes: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Generate referral number before saving
referralSchema.pre('save', async function(next) {
  if (!this.referralNo) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.referralNo = `REF-${year}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

export default mongoose.model('Referral', referralSchema);
