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
  getMyScheduleCardOffice
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
router.post('/patients/register', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), registerPatient);
router.get('/patients/search', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), searchPatients);
router.get('/patients/recent', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), getRecentPatients);
router.get('/patients/:id', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), getPatientById);
router.put('/patients/:id', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), updatePatient);
router.post('/patients/send-to-triage', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), sendToTriage);

// ==================== STATISTICS ====================
router.get('/stats', protect, restrictTo('card_office', 'card_office_staff', 'cardoffice'), getCardOfficeStats);

// ==================== STAFF PROFILE ====================
router.get('/profile', protect, getCardOfficeProfile);
router.put('/profile', protect, updateCardOfficeProfile);
router.put('/change-password', protect, changeCardOfficePassword);

// ==================== SCHEDULE ROUTES ====================
router.get('/my-schedule', protect, getMyScheduleCardOffice);

// ==================== REPORT MANAGEMENT ====================
router.get('/reports/inbox', protect, getCardOfficeReportsInbox);
router.get('/reports/outbox', protect, getCardOfficeReportsOutbox);
router.post('/reports/send', protect, upload.array('attachments', 5), sendCardOfficeReport);
router.post('/reports/:id/reply', protect, upload.single('attachment'), replyToCardOfficeReport);
router.put('/reports/:id/read', protect, markCardOfficeReportRead);
router.get('/hospital-admins', protect, getHospitalAdminsForCardOffice);

export default router;
// END OF FILE - NO REACT CODE BELOW THIS LINE