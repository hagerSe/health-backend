import express from 'express';
import { protect } from '../middleware/auth.js';
import { reportUpload } from '../middleware/upload.js';
import * as zoneController from '../controllers/zoneController.js';

const router = express.Router();

router.use(protect);

// Profile routes
router.get('/profile', zoneController.getProfile);
router.put('/profile', zoneController.updateProfile);
router.put('/change-password', zoneController.changePassword);

// Regional info
router.get('/regional-info', zoneController.getRegionalInfo);

// Woreda routes
router.get('/woredas-list', zoneController.getWoredasForReport);
router.get('/woredas', zoneController.getWoredas);
router.post('/woredas', zoneController.createWoredaAdmin);
router.put('/woredas/:id', zoneController.updateWoredaAdmin);
router.delete('/woredas/:id', zoneController.deleteWoredaAdmin);

// Report routes
router.post('/reports/send', reportUpload.array('attachments', 10), zoneController.sendReport);
router.get('/reports/inbox', zoneController.getInbox);
router.get('/reports/outbox', zoneController.getOutbox);
router.get('/reports/thread/:reportId', zoneController.getConversationThread);
router.get('/reports/:id', zoneController.getReportById);
router.post('/reports/:id/reply', reportUpload.array('attachments', 10), zoneController.replyToReport);
router.put('/reports/:id/read', zoneController.markReportAsRead);  // ✅ MAKE SURE THIS EXISTS

// Notification routes
router.get('/notifications', zoneController.getNotifications);
router.put('/notifications/:id/read', zoneController.markNotificationAsRead);
router.put('/notifications/read-all', zoneController.markAllNotificationsRead);

// Dashboard stats
router.get('/dashboard/stats', zoneController.getDashboardStats);

export default router;