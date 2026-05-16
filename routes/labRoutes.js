// backend/routes/labRoutes.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getLabRequests,
  getLabRequestById,
  startProcessing,
  collectSample,
  submitResults,
  getLabStats,
  cancelRequest,
  getLabProfile,
  updateLabProfile,
  changeLabPassword,
  getLabReportsInbox,
  getLabReportsOutbox,
  sendLabReport,
  replyToLabReport,
  markLabReportRead,
  getHospitalAdminsForLab,
  getMyLabSchedule,
  getMyLabWeeklySchedule,
  getMyLabTodaySchedule,
  getMyLabScheduleStats,
  getMyLabNotifications
} from '../controllers/labController.js';

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
    cb(null, `lab-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// ==================== LAB REQUESTS ====================
router.get('/pending', protect, getLabRequests);
router.get('/requests/:id', protect, getLabRequestById);
router.post('/start/:id', protect, startProcessing);
router.post('/collect/:id', protect, collectSample);
router.post('/results/:id', protect, submitResults);
router.post('/cancel/:id', protect, cancelRequest);
router.get('/stats', protect, getLabStats);

// ==================== STAFF PROFILE ====================
router.get('/profile', protect, getLabProfile);
router.put('/profile', protect, updateLabProfile);
router.put('/change-password', protect, changeLabPassword);

// ==================== REPORT MANAGEMENT ====================
router.get('/reports/inbox', protect, getLabReportsInbox);
router.get('/reports/outbox', protect, getLabReportsOutbox);
router.post('/reports/send', protect, upload.array('attachments', 5), sendLabReport);
router.post('/reports/:id/reply', protect, upload.single('attachment'), replyToLabReport);
router.put('/reports/:id/read', protect, markLabReportRead);
router.get('/hospital-admins', protect, getHospitalAdminsForLab);

// ==================== SCHEDULE VIEWING ====================
router.get('/my-schedule', protect, getMyLabSchedule);
router.get('/weekly-schedule', protect, getMyLabWeeklySchedule);
router.get('/today-schedule', protect, getMyLabTodaySchedule);
router.get('/schedule-stats', protect, getMyLabScheduleStats);
router.get('/notifications', protect, getMyLabNotifications);

export default router;