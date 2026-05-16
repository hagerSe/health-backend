import express from 'express';
import { protect } from '../middleware/auth.js';
import { reportUpload } from '../middleware/upload.js';
import * as federalController from '../controllers/federalController.js';

const router = express.Router();

router.use(protect);

// Profile routes
router.get('/profile', federalController.getProfile);
router.put('/profile', federalController.updateProfile);
router.put('/change-password', federalController.changePassword);

// Regions list for dropdown
router.get('/regions-list', federalController.getRegionsList);

// Regional management routes
router.get('/regions', federalController.getRegions);
router.post('/regions', federalController.createRegionalAdmin);
router.put('/regions/:id', federalController.updateRegionalAdmin);
router.delete('/regions/:id', federalController.deleteRegionalAdmin);

// Region zones view
router.get('/regions/:regionId/zones', federalController.getRegionZones);

// Report routes
router.post('/reports/send', reportUpload.array('attachments', 10), federalController.sendReport);
router.get('/reports/inbox', federalController.getInbox);
router.get('/reports/outbox', federalController.getOutbox);
router.get('/reports/thread/:reportId', federalController.getConversationThread);
router.get('/reports/:id', federalController.getReportById);
router.post('/reports/:id/reply', reportUpload.array('attachments', 10), federalController.replyToReport);
router.put('/reports/:id/read', federalController.markReportAsRead);

// Notification routes
router.get('/notifications', federalController.getNotifications);
router.put('/notifications/:id/read', federalController.markNotificationAsRead);
router.put('/notifications/read-all', federalController.markAllNotificationsRead);

// Dashboard stats
router.get('/dashboard/stats', federalController.getDashboardStats);

export default router;