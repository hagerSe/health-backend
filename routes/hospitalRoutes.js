import express from 'express';
import { protect } from '../middleware/auth.js';
import * as hospitalController from '../controllers/hospitalController.js';

const router = express.Router();

// Debug: Log to see which functions are available
console.log('✅ Hospital Controller loaded with:', Object.keys(hospitalController).length, 'functions');
console.log('Available functions:', Object.keys(hospitalController).join(', '));

// Apply authentication middleware to all routes
router.use(protect);

// ==================== PROFILE ROUTES ====================
if (hospitalController.getProfile) router.get('/profile', hospitalController.getProfile);
if (hospitalController.updateHospitalProfile) router.put('/profile', hospitalController.updateHospitalProfile);
if (hospitalController.changeHospitalPassword) router.put('/change-password', hospitalController.changeHospitalPassword);
if (hospitalController.getHospitalKebeleAdmin) router.get('/kebele-admin', hospitalController.getHospitalKebeleAdmin);

// ==================== STAFF MANAGEMENT ROUTES ====================
if (hospitalController.createStaff) router.post('/staff', hospitalController.createStaff);
if (hospitalController.getStaff) router.get('/staff', hospitalController.getStaff);
if (hospitalController.getAllHospitalStaff) router.get('/staff/all', hospitalController.getAllHospitalStaff);
if (hospitalController.updateStaff) router.put('/staff/:id', hospitalController.updateStaff);
if (hospitalController.deleteStaff) router.delete('/staff/:id', hospitalController.deleteStaff);

// ==================== STAFF FILTERING ROUTES ====================
if (hospitalController.getStaffByDepartment) router.get('/staff/department/:department', hospitalController.getStaffByDepartment);
if (hospitalController.getStaffByWard) router.get('/staff/ward/:ward', hospitalController.getStaffByWard);
if (hospitalController.getDepartmentStats) router.get('/departments/stats', hospitalController.getDepartmentStats);

// ==================== REPORT ROUTES - SPECIFIC ROUTES MUST COME FIRST ====================
if (hospitalController.sendReport) router.post('/reports/send', hospitalController.sendReport);
if (hospitalController.getInbox) router.get('/reports/inbox', hospitalController.getInbox);
if (hospitalController.getOutbox) router.get('/reports/outbox', hospitalController.getOutbox);
if (hospitalController.getConversationThread) router.get('/reports/thread/:reportId', hospitalController.getConversationThread);

// ENHANCED REPORTING & ANALYTICS ROUTES - SPECIFIC PATHS (MUST come before /reports/:id)
if (hospitalController.getReportSummary) router.get('/reports/summary', hospitalController.getReportSummary);
if (hospitalController.getReportTypes) router.get('/reports/types', hospitalController.getReportTypes);
if (hospitalController.getStaffListForReport) router.get('/reports/staff-list', hospitalController.getStaffListForReport);
if (hospitalController.getStaffDetailedReport) router.get('/reports/staff/:staffId', hospitalController.getStaffDetailedReport);

// GENERIC REPORT ROUTES WITH PARAMETERS (MUST come LAST)
if (hospitalController.getReportById) router.get('/reports/:id', hospitalController.getReportById);
if (hospitalController.replyToReport) router.post('/reports/:id/reply', hospitalController.replyToReport);
if (hospitalController.markReportAsRead) router.put('/reports/:id/read', hospitalController.markReportAsRead);

// ==================== NOTIFICATION ROUTES ====================
if (hospitalController.getNotifications) router.get('/notifications', hospitalController.getNotifications);
if (hospitalController.markNotificationAsRead) router.put('/notifications/:id/read', hospitalController.markNotificationAsRead);
if (hospitalController.markAllNotificationsRead) router.put('/notifications/read-all', hospitalController.markAllNotificationsRead);

// ==================== DASHBOARD ROUTES ====================
if (hospitalController.getDashboardStats) router.get('/dashboard/stats', hospitalController.getDashboardStats);
if (hospitalController.getPatientStatistics) router.get('/dashboard/patient-stats', hospitalController.getPatientStatistics);
if (hospitalController.getWardStatistics) router.get('/dashboard/ward-stats', hospitalController.getWardStatistics);
if (hospitalController.getDepartmentWardMapping) router.get('/dashboard/department-ward-mapping', hospitalController.getDepartmentWardMapping);

export default router;