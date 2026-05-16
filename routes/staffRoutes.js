import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  // Profile
  getStaffProfile,
  // Reports
  getStaffInbox,
  getStaffOutbox,
  getStaffReportById,
  sendStaffReport,
  replyToStaffReport,
  // Schedule
  getMySchedule,
  getMyWeeklySchedule,
  getMyTodaySchedule,
  getMyScheduleStats,
  // Notifications
  getMyNotifications,
  markStaffNotificationRead
} from '../controllers/staffController.js';

const router = express.Router();

// All staff routes require authentication
router.use(protect);

// ==================== PROFILE ROUTES ====================
router.get('/profile', getStaffProfile);

// ==================== REPORT ROUTES ====================
router.get('/reports/inbox', getStaffInbox);
router.get('/reports/outbox', getStaffOutbox);
router.get('/reports/:id', getStaffReportById);
router.post('/reports/send', sendStaffReport);
router.post('/reports/:id/reply', replyToStaffReport);

// ==================== SCHEDULE ROUTES ====================
router.get('/my-schedule', getMySchedule);
router.get('/weekly-schedule', getMyWeeklySchedule);
router.get('/today-schedule', getMyTodaySchedule);
router.get('/schedule-stats', getMyScheduleStats);

// ==================== NOTIFICATION ROUTES ====================
router.get('/notifications', getMyNotifications);
router.put('/notifications/:id/read', markStaffNotificationRead);

export default router;