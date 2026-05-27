// backend/routes/cardofficeRoutes.js
import express from 'express';
import {
  registerPatient,
  getPatientsInTriage,
  searchPatients,
  getPatientById,
  sendToTriage,
  getRecentPatients,
  updatePatient,
  getCardOfficeStats,
  getCardOfficeProfile,
  updateCardOfficeProfile,
  changeCardOfficePassword,
  getCardOfficeReportsInbox,
  getCardOfficeReportsOutbox,
  sendCardOfficeReport,
  replyToCardOfficeReport,
  markCardOfficeReportRead,
  getHospitalAdminsForCardOffice,
  getMyCardOfficeSchedule,
  getMyCardOfficeWeeklySchedule,
  getMyCardOfficeTodaySchedule,
  getMyCardOfficeScheduleStats,
  getMyCardOfficeNotifications
} from '../controllers/cardofficeController.js';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
    cb(null, `cardoffice-report-${uniqueSuffix}${path.extname(file.originalname)}`);
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

const router = express.Router();

// All routes require authentication
router.use(protect);

// ==================== PATIENT MANAGEMENT ====================
router.post('/register', registerPatient);
router.post('/send-to-triage', sendToTriage);
router.get('/patients/triage', getPatientsInTriage);
router.get('/patients/search', searchPatients);
router.get('/patients/:id', getPatientById);
router.put('/patients/:id', updatePatient);
router.get('/recent', getRecentPatients);

// ==================== DASHBOARD STATS ====================
router.get('/stats', getCardOfficeStats);

// ==================== PROFILE MANAGEMENT ====================
router.get('/profile', getCardOfficeProfile);
router.put('/profile', updateCardOfficeProfile);
router.put('/change-password', changeCardOfficePassword);

// ==================== REPORT MANAGEMENT ====================
router.get('/reports/inbox', getCardOfficeReportsInbox);
router.get('/reports/outbox', getCardOfficeReportsOutbox);
router.post('/reports/send', upload.array('attachments', 5), sendCardOfficeReport);
router.post('/reports/:id/reply', upload.array('attachments', 5), replyToCardOfficeReport);
router.put('/reports/:id/read', markCardOfficeReportRead);
router.get('/hospital-admins', getHospitalAdminsForCardOffice);

// ==================== SCHEDULE MANAGEMENT ====================
router.get('/my-schedule', getMyCardOfficeSchedule);
router.get('/weekly-schedule', getMyCardOfficeWeeklySchedule);
router.get('/today-schedule', getMyCardOfficeTodaySchedule);
router.get('/schedule-stats', getMyCardOfficeScheduleStats);

// ==================== NOTIFICATIONS ====================
router.get('/notifications', getMyCardOfficeNotifications);
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      where: {
        id: id,
        recipient_id: req.user.id,
        recipient_type: 'staff'
      }
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    await notification.update({ is_read: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;