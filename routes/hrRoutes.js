// backend/routes/hrRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { reportUpload } from '../middleware/upload.js';  // ✅ Use shared upload middleware
import {
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  autoGenerateSchedule,
  getShiftTypes,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  getStats,
  getHRProfile,
  updateHRProfile,
  changeHRPassword,
  getHRReportsInbox,
  getHRReportsOutbox,
  sendHRReport,
  replyToHRReport,
  markHRReportRead,
  getHospitalAdminsForHR,
  getStaffSchedule
} from '../controllers/hrController.js';

const router = express.Router();

// ✅ REMOVED local multer configuration (lines 10-40)
// Now using reportUpload from ../middleware/upload.js

// ==================== STAFF MANAGEMENT ====================
router.get('/staff', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getStaff);
router.post('/staff', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), addStaff);
router.put('/staff/:id', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), updateStaff);
router.delete('/staff/:id', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), deleteStaff);

// ==================== SCHEDULE MANAGEMENT ====================
router.get('/schedules', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getSchedules);
router.get('/schedules/:id', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getScheduleById);
router.post('/schedules', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), createSchedule);
router.put('/schedules/:id', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), updateSchedule);
router.delete('/schedules/:id', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), deleteSchedule);

// ==================== AUTO GENERATE SCHEDULE ====================
router.post('/schedule/auto-generate', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), autoGenerateSchedule);

// ==================== SHIFT TYPES ====================
router.get('/shifts', protect, getShiftTypes);

// ==================== LEAVE MANAGEMENT ====================
router.get('/leave-requests', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getLeaveRequests);
router.post('/leave-requests', protect, createLeaveRequest);
router.put('/leave-request/:id', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), updateLeaveRequest);

// ==================== STATISTICS ====================
router.get('/stats', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getStats);

// ==================== PROFILE MANAGEMENT ====================
router.get('/profile', protect, getHRProfile);
router.put('/profile', protect, updateHRProfile);
router.put('/change-password', protect, changeHRPassword);

// ==================== REPORT MANAGEMENT ====================
router.get('/reports/inbox', protect, getHRReportsInbox);
router.get('/reports/outbox', protect, getHRReportsOutbox);

// ✅ UPDATED: Use reportUpload instead of local upload
// ✅ Changed from upload.array('attachments', 5) to reportUpload.array('attachments', 10)
// ✅ Changed from upload.single('attachment') to reportUpload.array('attachments', 10) for consistency
router.post('/reports/send', 
  protect, 
  restrictTo('Human_Resource', 'hr', 'hospital_admin'), 
  reportUpload.array('attachments', 10),  // ← Now using shared middleware
  sendHRReport
);

router.post('/reports/:id/reply', 
  protect, 
  restrictTo('Human_Resource', 'hr', 'hospital_admin'), 
  reportUpload.array('attachments', 10),  // ← Now using shared middleware (array, not single)
  replyToHRReport
);

router.put('/reports/:id/read', protect, markHRReportRead);
router.get('/hospital-admins', protect, getHospitalAdminsForHR);

// ==================== ADDITIONAL ROUTES ====================
router.get('/staff/:staffId/schedule', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getStaffSchedule);

export default router;