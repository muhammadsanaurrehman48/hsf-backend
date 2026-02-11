import express from 'express';
import Referral from '../models/Referral.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get all referrals
router.get('/', verifyToken, async (req, res) => {
  try {
    const referrals = await Referral.find()
      .populate('patientId', 'name mrNo')
      .populate('referringDoctor', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: referrals,
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referrals',
    });
  }
});

// Get single referral
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('patientId', 'name mrNo')
      .populate('referringDoctor', 'name')
      .populate('createdBy', 'name');
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found',
      });
    }
    
    res.json({
      success: true,
      data: referral,
    });
  } catch (error) {
    console.error('Error fetching referral:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral',
    });
  }
});

// Create referral
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      forceNo,
      patientAge,
      patientGender,
      patientPhone,
      referredTo,
      referredDoctor,
      diagnosis,
      reasonForReferral,
      clinicalHistory,
      treatmentGiven,
      investigationsDone,
      urgency,
      notes,
    } = req.body;

    const referral = new Referral({
      patientId,
      patientName,
      forceNo,
      patientAge,
      patientGender,
      patientPhone,
      referredTo,
      referredDoctor,
      referringDoctor: req.user.id,
      referringDoctorName: req.user.name,
      diagnosis,
      reasonForReferral,
      clinicalHistory,
      treatmentGiven,
      investigationsDone,
      urgency,
      notes,
      createdBy: req.user.id,
    });

    await referral.save();

    res.status(201).json({
      success: true,
      data: referral,
      message: 'Referral created successfully',
    });
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create referral',
    });
  }
});

// Update referral status
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found',
      });
    }
    
    res.json({
      success: true,
      data: referral,
      message: 'Referral updated successfully',
    });
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update referral',
    });
  }
});

// Delete referral
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const referral = await Referral.findByIdAndDelete(req.params.id);
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Referral deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting referral:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete referral',
    });
  }
});

export default router;
