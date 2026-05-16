import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getQueue,
  getAssignedPatients,
  assignPatient,
  saveVitals,
  getVitalsHistory,
  saveNursingNotes,
  completeCareTask,
  completePatientCare,
  getStats,
  getNurseReportsInbox,
  getNurseReportsOutbox,
  sendNurseReport,
  replyToNurseReport,
  markNurseReportRead,
  setNurseReportReminder,
  getHospitalAdminsForNurse,
  getDoctorsForNurse,
  getPharmacyStaffForNurse,
  getLabStaffForNurse,
  getAllStaffForNurse,
  getNurseProfile,
  updateNurseProfile,
  changeNursePassword,
  getNurseReminders
} from '../controllers/nurseController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Ensure upload directories exist
const uploadDir = 'uploads/reports';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads/reports directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `report-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Apply authentication middleware to all routes
router.use(protect);
router.use(restrictTo('nurse', 'staff_nurse', 'anc_nurse', 'midwife'));

// ==================== PATIENT MANAGEMENT ====================
router.get('/queue', getQueue);
router.get('/assigned-patients', getAssignedPatients);
router.post('/assign-patient', assignPatient);
router.post('/complete-care', completePatientCare);

// ==================== VITALS MANAGEMENT ====================
router.post('/save-vitals', saveVitals);
router.get('/vitals-history/:patientId', getVitalsHistory);

// ==================== NURSING NOTES ====================
router.post('/save-notes', saveNursingNotes);

// ==================== CARE TASKS ====================
router.put('/complete-task/:taskId', completeCareTask);

// ==================== STATISTICS ====================
router.get('/stats', getStats);

// ==================== REPORTS SYSTEM ====================
router.get('/reports/inbox', getNurseReportsInbox);
router.get('/reports/outbox', getNurseReportsOutbox);

// IMPORTANT: Use upload.fields() or upload.any() for mixed form data
router.post('/reports/send', upload.any(), (req, res, next) => {
  console.log('📦 After multer - req.body:', req.body);
  console.log('📦 After multer - req.files:', req.files);
  next();
}, sendNurseReport);

router.put('/reports/:id/read', markNurseReportRead);
router.post('/reports/:id/reply', replyToNurseReport);
router.post('/reports/:id/reminder', setNurseReportReminder);
router.get('/reports/reminders', getNurseReminders);

// ==================== STAFF LISTS FOR REPORT RECIPIENTS ====================
router.get('/hospital-admins', getHospitalAdminsForNurse);
router.get('/doctors', getDoctorsForNurse);
router.get('/pharmacy-staff', getPharmacyStaffForNurse);
router.get('/lab-staff', getLabStaffForNurse);
router.get('/all-staff', getAllStaffForNurse);

// ==================== PROFILE MANAGEMENT ====================
router.get('/profile', getNurseProfile);
router.put('/profile', updateNurseProfile);
router.put('/change-password', changeNursePassword);

export default router;