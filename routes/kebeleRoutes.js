import express from 'express';
import { protect } from '../middleware/auth.js';
import { reportUpload } from '../middleware/upload.js';
import * as kebeleController from '../controllers/kebeleController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// ==================== PROFILE ROUTES ====================
router.get('/profile', kebeleController.getProfile);
router.put('/profile', kebeleController.updateKebeleProfile);
router.put('/change-password', kebeleController.changeKebelePassword);

// ==================== HOSPITAL MANAGEMENT ROUTES ====================
router.post('/hospitals', kebeleController.createHospital);
router.get('/hospitals', kebeleController.getHospitals);
router.get('/hospitals/all', kebeleController.getAllHospitals);
router.get('/hospitals/stats/summary', kebeleController.getHospitalStats);
router.get('/hospitals/:id', kebeleController.getHospitalById);
router.put('/hospitals/:id', kebeleController.updateHospital);
router.delete('/hospitals/:id', kebeleController.deleteHospital);

// ==================== HOSPITAL STAFF ROUTES ====================
router.get('/hospitals/:hospitalId/staff', kebeleController.getHospitalStaff);
router.get('/hospitals/:hospitalId/staff/stats', kebeleController.getHospitalStaffStats);

// ==================== WOREDA MANAGEMENT ROUTES ====================
router.get('/woredas/all', kebeleController.getAllWoredas);

// ==================== REPORT ROUTES ====================
// IMPORTANT: Use reportUpload for file attachments
router.post('/reports/send', reportUpload.array('attachments', 10), kebeleController.sendReport);
router.get('/reports/inbox', kebeleController.getInbox);
router.get('/reports/outbox', kebeleController.getOutbox);

// Conversation thread - MUST come BEFORE /reports/:id
router.get('/reports/thread/:reportId', kebeleController.getConversationThread);

// Report analytics
router.get('/reports/summary', kebeleController.getReportSummary);
router.get('/reports/types', kebeleController.getReportTypes);
router.get('/reports/hospitals-list', kebeleController.getHospitalListForReport);
router.get('/reports/hospital/:hospitalId', kebeleController.getHospitalDetailedReport);

// Single report operations (MUST come AFTER /thread route)
router.get('/reports/:id', kebeleController.getReportById);
router.post('/reports/:id/reply', reportUpload.array('attachments', 10), kebeleController.replyToReport);
router.put('/reports/:id/read', kebeleController.markReportAsRead);

// ==================== NOTIFICATION ROUTES ====================
router.get('/notifications', kebeleController.getNotifications);
router.put('/notifications/:id/read', kebeleController.markNotificationAsRead);
router.put('/notifications/read-all', kebeleController.markAllNotificationsRead);

// ==================== DASHBOARD STATS ROUTES ====================
router.get('/dashboard/stats', kebeleController.getDashboardStats);
router.get('/dashboard/report-stats', kebeleController.getReportStatistics);
router.get('/dashboard/hospital-stats', kebeleController.getHospitalStatistics);

export default router;