// backend/routes/triageRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
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
  getHospitalAdminsForTriage
} from '../controllers/triageController.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('triage'));

// Triage Queue Routes
router.get('/queue', getTriageQueue);
router.get('/triaged', getTriagedPatients);
router.get('/patient/:id', getPatientForTriage);
router.post('/send-to-ward', recordVitalsAndSendToWard);
router.get('/stats', getTriageStats);

// Profile Routes
router.get('/profile', getTriageProfile);
router.put('/profile', updateTriageProfile);
router.put('/change-password', changeTriagePassword);

// Report Routes
router.get('/reports/inbox', getTriageReportsInbox);
router.get('/reports/outbox', getTriageReportsOutbox);
router.post('/reports/send', upload.array('attachments', 10), sendTriageReport);
router.post('/reports/:id/reply', upload.single('attachment'), replyToTriageReport);
router.put('/reports/:id/read', markTriageReportRead);
router.get('/hospital-admins', getHospitalAdminsForTriage);

export default router;