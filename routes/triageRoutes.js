// backend/routes/triageRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  getTriageQueue,
  getTriagedPatients,
  getPatientForTriage,
  recordVitalsAndSendToWard,
  getTriageStats,
  getTriageProfile,
  updateTriageProfile,
  changeTriagePassword,
  getTriageReportsInbox,
  getTriageReportsOutbox,
  sendTriageReport,
  replyToTriageReport,
  markTriageReportRead,
  getHospitalAdminsForTriage,
  getMyScheduleTriage,
  upload
} from '../controllers/triageController.js';

const router = express.Router();

// Apply authentication and role restriction
router.use(protect);
router.use(restrictTo('triage', 'triage_nurse', 'nurse'));

// ==================== TRIAGE QUEUE ROUTES ====================
router.get('/queue', getTriageQueue);
router.get('/triaged', getTriagedPatients);
router.get('/patient/:id', getPatientForTriage);
router.post('/send-to-ward', recordVitalsAndSendToWard);
router.get('/stats', getTriageStats);

// ==================== SCHEDULE ROUTE ====================
router.get('/my-schedule', getMyScheduleTriage);

// ==================== PROFILE ROUTES ====================
router.get('/profile', getTriageProfile);
router.put('/profile', updateTriageProfile);
router.put('/change-password', changeTriagePassword);

// ==================== REPORT ROUTES ====================
router.get('/reports/inbox', getTriageReportsInbox);
router.get('/reports/outbox', getTriageReportsOutbox);
router.post('/reports/send', upload.array('attachments', 10), sendTriageReport);
router.post('/reports/:id/reply', upload.single('attachment'), replyToTriageReport);
router.put('/reports/:id/read', markTriageReportRead);
router.get('/hospital-admins', getHospitalAdminsForTriage);

export default router;