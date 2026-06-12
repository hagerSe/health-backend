// backend/routes/bedRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { reportUpload } from '../middleware/upload.js';  // ✅ IMPORT THE SHARED MIDDLEWARE
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

const router = express.Router();

// ==================== PROFILE ROUTES ====================
router.get('/profile', protect, getBedManagementProfile);
router.put('/profile', protect, updateBedManagementProfile);
router.put('/change-password', protect, changeBedManagementPassword);

// ==================== HOSPITAL ADMINS ROUTE ====================
router.get('/hospital-admins', protect, restrictTo('bed_management', 'bed_manager'), getHospitalAdminsForBedManagement);

// ==================== REPORT ROUTES - USING SHARED UPLOAD ====================
router.get('/reports/inbox', protect, restrictTo('bed_management', 'bed_manager'), getBedManagementReportsInbox);
router.get('/reports/outbox', protect, restrictTo('bed_management', 'bed_manager'), getBedManagementReportsOutbox);

// ✅ FIXED: Use reportUpload from shared middleware
router.post('/reports/send', 
  protect, 
  restrictTo('bed_management', 'bed_manager'), 
  reportUpload.array('attachments', 10),  // ← Using shared middleware
  sendBedManagementReport
);

router.post('/reports/:id/reply', 
  protect, 
  restrictTo('bed_management', 'bed_manager'), 
  reportUpload.array('attachments', 10),  // ← Using shared middleware
  replyToBedManagementReport
);

router.put('/reports/:id/read', protect, restrictTo('bed_management', 'bed_manager'), markBedManagementReportRead);

// ==================== STATS ROUTES ====================
router.get('/stats/ward', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin'), getWardStats);

// ==================== BED MANAGEMENT ROUTES ====================
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

// ==================== GET BED BY ID (MUST COME LAST) ====================
router.get('/:id', protect, restrictTo('bed_management', 'bed_manager', 'hospital_admin', 'nurse', 'doctor'), getBedById);

export default router;