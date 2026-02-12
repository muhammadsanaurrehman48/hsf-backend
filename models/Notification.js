import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['appointment_created', 'vitals_recorded', 'consultation_completed', 'lab_request', 'radiology_request'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'ID of appointment, patient, or other related entity',
    },
    relatedType: {
      type: String,
      enum: ['appointment', 'patient', 'vitals', 'lab_request', 'radiology_request'],
    },
    read: {
      type: Boolean,
      default: false,
    },
    actionUrl: {
      type: String,
      description: 'URL where user should navigate to take action',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: 604800 }, // Auto-delete after 7 days
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
