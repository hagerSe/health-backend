// routes/radiologyRoutes.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getPendingRequests,
  getInProgressRequests,
  getCompletedRequests,
  startExam,
  uploadImages,
  submitReport,
  getReport,
  getRadiologyProfile,
  updateRadiologyProfile,
  changeRadiologyPassword,
  getHospitalAdminsForRadiology,
  getRadiologyReportsInbox,
  getRadiologyReportsOutbox,
  sendRadiologyReport,
  replyToRadiologyReport,
  markRadiologyReportRead,
  upload
} from '../controllers/radiologyController.js';

const router = express.Router();

// Configure multer for file uploads (add this if not already in controller)
const reportsDir = 'uploads/reports';
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// ==================== RADIOLOGY REQUEST ROUTES ====================
// All routes use only 'protect' middleware (no role restrictions)
router.get('/pending', protect, getPendingRequests);
router.get('/in-progress', protect, getInProgressRequests);
router.get('/completed', protect, getCompletedRequests);
router.put('/requests/:id/start', protect, startExam);
router.post('/upload/:id', protect, upload.array('images', 20), uploadImages);
router.put('/report/:id', protect, upload.array('images', 20), submitReport);
router.get('/report/:id', protect, getReport);

// ==================== PROFILE ROUTES ====================
router.get('/profile', protect, getRadiologyProfile);
router.put('/profile', protect, updateRadiologyProfile);
router.put('/change-password', protect, changeRadiologyPassword);

// ==================== REPORT ROUTES ====================
router.get('/hospital-admins', protect, getHospitalAdminsForRadiology);
router.get('/reports/inbox', protect, getRadiologyReportsInbox);
router.get('/reports/outbox', protect, getRadiologyReportsOutbox);
router.post('/reports/send', protect, upload.array('attachments', 5), sendRadiologyReport);
router.post('/reports/:id/reply', protect, upload.single('attachment'), replyToRadiologyReport);
router.put('/reports/:id/read', protect, markRadiologyReportRead);

export default router;