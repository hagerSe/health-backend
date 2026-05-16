// backend/routes/hrRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// Configure multer for file uploads
const reportsDir = 'uploads/reports';
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reportsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `hr-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

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
router.post('/reports/send', protect, upload.array('attachments', 5), sendHRReport);
router.post('/reports/:id/reply', protect, upload.single('attachment'), replyToHRReport);
router.put('/reports/:id/read', protect, markHRReportRead);
router.get('/hospital-admins', protect, getHospitalAdminsForHR);

// ==================== ADDITIONAL ROUTES ====================
router.get('/staff/:staffId/schedule', protect, restrictTo('Human_Resource', 'hr', 'hospital_admin'), getStaffSchedule);

export default router;