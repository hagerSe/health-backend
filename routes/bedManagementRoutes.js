// backend/routes/bedManagementRoutes.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getBedManagementProfile,
  updateBedManagementProfile,
  changeBedManagementPassword,
  getBedManagementReportsInbox,
  getBedManagementReportsOutbox,
  sendBedManagementReport,
  replyToBedManagementReport,
  markBedManagementReportRead,
  getHospitalAdminsForBedManagement
} from '../controllers/bedController.js';

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
    cb(null, `bed-report-${uniqueSuffix}${path.extname(file.originalname)}`);
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

// ==================== PROFILE MANAGEMENT ====================
router.get('/profile', protect, getBedManagementProfile);
router.put('/profile', protect, updateBedManagementProfile);
router.put('/change-password', protect, changeBedManagementPassword);

// ==================== REPORT MANAGEMENT ====================
router.get('/reports/inbox', protect, getBedManagementReportsInbox);
router.get('/reports/outbox', protect, getBedManagementReportsOutbox);
router.post('/reports/send', protect, upload.array('attachments', 5), sendBedManagementReport);
router.post('/reports/:id/reply', protect, upload.single('attachment'), replyToBedManagementReport);
router.put('/reports/:id/read', protect, markBedManagementReportRead);
router.get('/hospital-admins', protect, getHospitalAdminsForBedManagement);

export default router;