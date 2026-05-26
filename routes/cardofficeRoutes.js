
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  registerPatient,
  searchPatients,
  getPatientById,
  sendToTriage,
  getRecentPatients,
  getCardOfficeStats,
  updatePatient,
  getCardOfficeProfile,
  updateCardOfficeProfile,
  changeCardOfficePassword,
  getCardOfficeReportsInbox,
  getCardOfficeReportsOutbox,
  sendCardOfficeReport,
  replyToCardOfficeReport,
  markCardOfficeReportRead,
  getHospitalAdminsForCardOffice,
  getMyScheduleCardOffice  // ← ADD THIS IMPORT
} from '../controllers/cardofficeController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
    cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// ==================== PATIENT MANAGEMENT ====================
// Card office staff can register patients
router.post('/patients/register', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), registerPatient);

// Search patients - card office staff can search
router.get('/patients/search', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), searchPatients);

// Get recent patients
router.get('/patients/recent', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), getRecentPatients);

// Get patient by ID
router.get('/patients/:id', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), getPatientById);

// Update patient
router.put('/patients/:id', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), updatePatient);

// Send returning patient to triage
router.post('/patients/send-to-triage', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), sendToTriage);

// ==================== STATISTICS ====================
router.get('/stats', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), getCardOfficeStats);

// ==================== STAFF PROFILE ====================
// Get profile - any authenticated staff
router.get('/profile', protect, getCardOfficeProfile);

// Update profile
router.put('/profile', protect, updateCardOfficeProfile);

// Change password
router.put('/change-password', protect, changeCardOfficePassword);

// ==================== SCHEDULE ROUTES ====================
// Get schedule for logged-in card office staff
router.get('/my-schedule', protect, getMyScheduleCardOffice);  // ← NOW THIS WILL WORK

// ==================== REPORT MANAGEMENT ====================
// Get inbox reports
router.get('/reports/inbox', protect, getCardOfficeReportsInbox);

// Get outbox reports
router.get('/reports/outbox', protect, getCardOfficeReportsOutbox);

// Send report to hospital admin
router.post('/reports/send', protect, upload.array('attachments', 5), sendCardOfficeReport);

// Reply to a report
router.post('/reports/:id/reply', protect, upload.single('attachment'), replyToCardOfficeReport);

// Mark report as read
router.put('/reports/:id/read', protect, markCardOfficeReportRead);

// Get hospital admins for sending reports
router.get('/hospital-admins', protect, getHospitalAdminsForCardOffice);

export default router;