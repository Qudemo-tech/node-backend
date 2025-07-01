const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Get user notifications
router.get('/:userId', notificationController.getNotifications);

// Mark notification as read
router.put('/:notificationId/read', notificationController.markNotificationAsRead);

// Mark all notifications as read
router.put('/:userId/read-all', notificationController.markAllNotificationsAsRead);

// Get unread notification count
router.get('/:userId/unread-count', notificationController.getUnreadCount);

// Delete notification
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router; 