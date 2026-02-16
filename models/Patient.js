import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
    {
        patientNo: {
            type: String,
            required: true,
            unique: true,
        },
        patientType: {
            type: String,
            enum: ['ASF', 'ASF_FAMILY', 'ASF_SCHOOL', 'ASF_FOUNDATION', 'CIVILIAN'],
            required: true,
        },
        forceNo: {
            type: String,
            required: function() {
                return this.patientType === 'ASF' || this.patientType === 'ASF_FAMILY' || this.patientType === 'ASF_SCHOOL';
            },
        },
        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            required: true,
        },
        familyHead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
        },
        relationToHead: {
            type: String,
            enum: ['self', 'spouse', 'child', 'parent', 'sibling', 'other'],
            default: 'self',
        },
        householdId: {
            type: String,
        },
        isHouseholdHead: {
            type: Boolean,
            default: true,
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
            lowercase: true,
            required: true
        },
        dateOfBirth: {
            type: String,
        },
        bloodGroup: {
            type: String,
        },
        cnic: {
            type: String,
        },
        phone: {
            type: String,
        },
        email: {
            type: String,
        },
        address: {
            type: String,
        },
        city: {
            type: String,
        },
        emergencyContact: {
            name: String,
            phone: String,
            relation: String,
        },
        allergies: {
            type: String,
        },
        existingConditions: {
            type: String,
        },
    },
    { timestamps: true }
);

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
