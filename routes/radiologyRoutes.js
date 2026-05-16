// routes/radiologyRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
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

// ==================== RADIOLOGY REQUEST ROUTES ====================
router.get('/pending', protect, restrictTo('radiology', 'radiologist', 'radio', 'hospital_admin'), getPendingRequests);
router.get('/in-progress', protect, restrictTo('radiology', 'radiologist', 'radio', 'hospital_admin'), getInProgressRequests);
router.get('/completed', protect, restrictTo('radiology', 'radiologist', 'radio', 'hospital_admin'), getCompletedRequests);
router.put('/requests/:id/start', protect, restrictTo('radiology', 'radiologist', 'radio'), startExam);
router.post('/upload/:id', protect, restrictTo('radiology', 'radiologist', 'radio'), upload.array('images', 20), uploadImages);
router.put('/report/:id', protect, restrictTo('radiology', 'radiologist', 'radio'), submitReport);
router.get('/report/:id', protect, restrictTo('radiology', 'radiologist', 'radio', 'doctor', 'nurse'), getReport);

// ==================== PROFILE ROUTES ====================
router.get('/profile', protect, getRadiologyProfile);
router.put('/profile', protect, updateRadiologyProfile);
router.put('/change-password', protect, changeRadiologyPassword);

// ==================== REPORT ROUTES ====================
router.get('/hospital-admins', protect, restrictTo('radiology', 'radiologist', 'radio'), getHospitalAdminsForRadiology);
router.get('/reports/inbox', protect, restrictTo('radiology', 'radiologist', 'radio'), getRadiologyReportsInbox);
router.get('/reports/outbox', protect, restrictTo('radiology', 'radiologist', 'radio'), getRadiologyReportsOutbox);
router.post('/reports/send', protect, restrictTo('radiology', 'radiologist', 'radio'), upload.array('attachments', 5), sendRadiologyReport);
router.post('/reports/:id/reply', protect, restrictTo('radiology', 'radiologist', 'radio'), upload.single('attachment'), replyToRadiologyReport);
router.put('/reports/:id/read', protect, restrictTo('radiology', 'radiologist', 'radio'), markRadiologyReportRead);

export default router;