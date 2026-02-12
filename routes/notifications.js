import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get notifications for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, read } = req.query;

    let filter = { userId };
    if (read === 'true') {
      filter.read = true;
    } else if (read === 'false') {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(filter);

    console.log('🔔 [BACKEND] Retrieved', notifications.length, 'notifications for user');

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
});

// Get unread notification count
router.get('/count/unread', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    console.log('📊 [BACKEND] Unread notifications:', unreadCount);

    res.json({ success: true, data: unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Error fetching count' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', verifyToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId }, // Ensure user can only read their own notifications
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    console.log('✅ [BACKEND] Notification marked as read');
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Error updating notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    console.log('✅ [BACKEND] All notifications marked as read:', result.modifiedCount);
    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Error updating notifications' });
  }
});

// Delete a notification
router.delete('/:notificationId', verifyToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId, // Ensure user can only delete their own notifications
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    console.log('🗑️  [BACKEND] Notification deleted');
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Error deleting notification' });
  }
});

export default router;
