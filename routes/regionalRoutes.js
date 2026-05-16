import express from 'express';
import { protect } from '../middleware/auth.js';
import { reportUpload } from '../middleware/upload.js';
import * as regionalController from '../controllers/regionalController.js';

const router = express.Router();

router.use(protect);

// Profile routes
router.get('/profile', regionalController.getProfile);
router.put('/profile', regionalController.updateProfile);
router.put('/change-password', regionalController.changePassword);

// Federal info route
router.get('/federal-info', regionalController.getFederalInfo);

// Zone routes
router.get('/zones-list', regionalController.getZonesForReport);
router.get('/zones', regionalController.getZones);
router.post('/zones', regionalController.createZoneAdmin);
router.put('/zones/:id', regionalController.updateZoneAdmin);
router.delete('/zones/:id', regionalController.deleteZoneAdmin);

// Zone -> Woreda view
router.get('/zones/:zoneId/woredas', regionalController.getZoneWoredas);

// Woreda -> Kebele view
router.get('/woredas/:woredaId/kebeles', regionalController.getWoredaKebeles);

// Report routes
router.post('/reports/send', reportUpload.array('attachments', 10), regionalController.sendReport);
router.get('/reports/inbox', regionalController.getInbox);
router.get('/reports/outbox', regionalController.getOutbox);
router.get('/reports/thread/:reportId', regionalController.getConversationThread);
router.get('/reports/:id', regionalController.getReportById);
router.post('/reports/:id/reply', reportUpload.array('attachments', 10), regionalController.replyToReport);
router.put('/reports/:id/read', regionalController.markReportAsRead);

// Notification routes
router.get('/notifications', regionalController.getNotifications);
router.put('/notifications/:id/read', regionalController.markNotificationAsRead);
router.put('/notifications/read-all', regionalController.markAllNotificationsRead);

// Dashboard stats
router.get('/dashboard/stats', regionalController.getDashboardStats);

export default router;