// backend/routes/bedRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  getAvailableBeds,
  getAllBeds,
  getBedById,
  registerBed,
  updateBedStatus,
  assignBed,
  releaseBed,
  cleanBed,
  getWardStats,
  getBedLogs,
  deleteBed,
  getBedManagementProfile,
  updateBedManagementProfile,
  changeBedManagementPassword,
  getHospitalAdminsForBedManagement,
  getBedManagementReportsInbox,
  getBedManagementReportsOutbox,
  sendBedManagementReport,
  replyToBedManagementReport,
  markBedManagementReportRead
} from '../controllers/bedController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// ==================== MULTER CONFIGURATION ====================
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

// ==================== PROFILE ROUTES (MUST COME BEFORE /:id) ====================
router.get('/profile', protect, getBedManagementProfile);
router.put('/profile', protect, updateBedManagementProfile);
router.put('/change-password', protect, changeBedManagementPassword);

// ==================== HOSPITAL ADMINS ROUTE ====================
router.get('/hospital-admins', protect, restrictTo('bed_management', 'bed_manager'), getHospitalAdminsForBedManagement);

// ==================== REPORT ROUTES ====================
router.get('/reports/inbox', protect, restrictTo('bed_management', 'bed_manager'), getBedManagementReportsInbox);
router.get('/reports/outbox', protect, restrictTo('bed_management', 'bed_manager'), getBedManagementReportsOutbox);
router.post('/reports/send', protect, restrictTo('bed_management', 'bed_manager'), upload.array('attachments', 5), sendBedManagementReport);
router.post('/reports/:id/reply', protect, restrictTo('bed_management', 'bed_manager'), upload.single('attachment'), replyToBedManagementReport);
router.put('/reports/:id/read', protect, restrictTo('bed_management', 'bed_manager'), markBedManagementReportRead);

// ==================== STATS ROUTES ====================
router.get('/stats/ward', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin'), getWardStats);

// ==================== BED MANAGEMENT ROUTES (SPECIFIC FIRST) ====================
router.get('/available', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'nurse', 'doctor'), getAvailableBeds);
router.get('/all', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'nurse', 'doctor'), getAllBeds);
router.get('/logs/:bedId', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin'), getBedLogs);

// ==================== BED OPERATIONS ====================
router.post('/register', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin'), registerBed);
router.post('/assign', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'doctor', 'nurse'), assignBed);
router.post('/release', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'doctor', 'nurse'), releaseBed);
router.post('/clean', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin'), cleanBed);
router.put('/:bedId/status', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'nurse'), updateBedStatus);
router.delete('/:bedId', protect, restrictTo('hospital_admin'), deleteBed);

// ==================== GET BED BY ID (MUST COME LAST - PARAMETERIZED) ====================
router.get('/:id', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'nurse', 'doctor'), getBedById);

export default router;