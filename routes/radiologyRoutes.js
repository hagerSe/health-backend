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
// GET routes - allow multiple roles
router.get('/pending', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'hospital_admin', 'admin', 'staff', 'doctor'), 
  getPendingRequests
);

router.get('/in-progress', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'hospital_admin', 'admin', 'staff', 'doctor'), 
  getInProgressRequests
);

router.get('/completed', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'hospital_admin', 'admin', 'staff', 'doctor'), 
  getCompletedRequests
);

// PUT routes - staff level access
router.put('/requests/:id/start', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'staff', 'doctor', 'admin'), 
  startExam
);

router.put('/report/:id', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'staff', 'doctor', 'admin'), 
  upload.array('images', 20), 
  submitReport
);

// GET report - view access for multiple roles
router.get('/report/:id', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'doctor', 'nurse', 'staff', 'admin'), 
  getReport
);

// Image upload route
router.post('/upload/:id', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'staff', 'admin'), 
  upload.array('images', 20), 
  uploadImages
);

// ==================== PROFILE ROUTES ====================
// Profile routes - allow any authenticated user (no role restriction)
router.get('/profile', protect, getRadiologyProfile);
router.put('/profile', protect, updateRadiologyProfile);
router.put('/change-password', protect, changeRadiologyPassword);

// ==================== REPORT ROUTES ====================
// Report routes - staff level access
router.get('/hospital-admins', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'admin', 'staff', 'hospital_admin'), 
  getHospitalAdminsForRadiology
);

router.get('/reports/inbox', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'admin', 'staff', 'hospital_admin'), 
  getRadiologyReportsInbox
);

router.get('/reports/outbox', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'admin', 'staff', 'hospital_admin'), 
  getRadiologyReportsOutbox
);

router.post('/reports/send', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'admin', 'staff'), 
  upload.array('attachments', 5), 
  sendRadiologyReport
);

router.post('/reports/:id/reply', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'admin', 'staff'), 
  upload.single('attachment'), 
  replyToRadiologyReport
);

router.put('/reports/:id/read', 
  protect, 
  restrictTo('radiology', 'radiologist', 'radio', 'admin', 'staff', 'hospital_admin'), 
  markRadiologyReportRead
);

export default router;