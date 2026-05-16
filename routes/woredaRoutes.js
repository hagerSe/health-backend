import express from 'express';
import { protect } from '../middleware/auth.js';
import upload, { reportUpload } from '../middleware/upload.js';
import * as woredaController from '../controllers/woredaController.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Profile routes
router.get('/profile', woredaController.getProfile);
router.put('/profile', woredaController.updateProfile);
router.put('/change-password', woredaController.changePassword);

// Zone info route
router.get('/zone-info', woredaController.getZoneInfo);

// Kebele management routes
router.get('/kebeles-list', woredaController.getKebelesForReport);
router.get('/kebeles', woredaController.getKebeles);
router.post('/kebeles', woredaController.createKebeleAdmin);
router.put('/kebeles/:id', woredaController.updateKebeleAdmin);
router.delete('/kebeles/:id', woredaController.deleteKebeleAdmin);

// ==================== KEBELE HOSPITAL VIEW ROUTES ====================
router.get('/kebeles/:kebeleId/hospitals', woredaController.getKebeleHospitals);

// ==================== REPORT ROUTES ====================
// Send report with attachments
router.post('/reports/send', reportUpload.array('attachments', 10), woredaController.sendReport);

// Get inbox and outbox
router.get('/reports/inbox', woredaController.getInbox);
router.get('/reports/outbox', woredaController.getOutbox);

// Conversation thread - IMPORTANT: This must come BEFORE the /reports/:id route
router.get('/reports/thread/:reportId', woredaController.getConversationThread);

// Get single report by ID (must be AFTER /thread route to avoid conflict)
router.get('/reports/:id', woredaController.getReportById);

// Reply to report with attachments
router.post('/reports/:id/reply', reportUpload.array('attachments', 10), woredaController.replyToReport);

// Mark report as read
router.put('/reports/:id/read', woredaController.markReportAsRead);

// ==================== NOTIFICATION ROUTES ====================
router.get('/notifications', woredaController.getNotifications);
router.put('/notifications/:id/read', woredaController.markNotificationAsRead);
router.put('/notifications/read-all', woredaController.markAllNotificationsRead);

// ==================== DASHBOARD STATS ====================
router.get('/dashboard/stats', woredaController.getDashboardStats);

export default router;