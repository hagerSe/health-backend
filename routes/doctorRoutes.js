// routes/doctorRoutes.js
import express from 'express';
import {
  getQueue,
  getStats,
  assignPatient,
  saveDiagnosis,
  savePrescriptions,
  getLabResults,
  getRadiologyResults,
  getAvailableBeds,
  admitPatient,
  requestLab,
  requestRadiology,
  dischargePatient,
  referPatient,
  getDischargedPatients,
  checkLabResults,
  getWardBeds,
  checkNewResults,
  // ==================== REPORT CONTROLLER IMPORTS ====================
  getDoctorReportsInbox,
  getDoctorReportsOutbox,
  getDoctorUnreadReportCount,
  getDoctorReportById,
  sendDoctorReport,
  replyToDoctorReport,
  markDoctorReportRead,
  getHospitalAdminsForDoctor,
  getHospitalStaffForDoctor,
  // ==================== PROFILE CONTROLLER IMPORTS ====================
  getDoctorProfile,
  updateDoctorProfile,
  changeDoctorPassword,
  // ==================== REMINDER CONTROLLER IMPORTS ====================
  setReportReminder,
  getDoctorReminders,
  // ==================== SCHEDULE CONTROLLER IMPORT ====================
  getDoctorSchedule,          // <-- ADD THIS LINE
  getAllStaffSchedules
} from '../controllers/doctorController.js';
import { protect, restrictTo, isDoctor } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ==================== PATIENT MANAGEMENT ROUTES ====================
router.get('/queue', restrictTo('doctor', 'staff'), getQueue);
router.get('/stats', restrictTo('doctor', 'staff'), getStats);
router.post('/assign-patient', restrictTo('doctor', 'staff'), assignPatient);
router.post('/save-diagnosis', restrictTo('doctor', 'staff'), saveDiagnosis);
router.post('/save-prescriptions', restrictTo('doctor', 'staff'), savePrescriptions);
router.get('/lab-results/:patientId', restrictTo('doctor', 'staff'), getLabResults);
router.get('/radiology-results/:patientId', restrictTo('doctor', 'staff'), getRadiologyResults);
router.get('/available-beds', restrictTo('doctor', 'staff'), getAvailableBeds);
router.post('/admit-patient', restrictTo('doctor', 'staff'), admitPatient);
router.post('/request-lab', restrictTo('doctor', 'staff'), requestLab);
router.post('/request-radiology', restrictTo('doctor', 'staff'), requestRadiology);
router.post('/discharge-patient', restrictTo('doctor', 'staff'), dischargePatient);
router.post('/refer-patient', restrictTo('doctor', 'staff'), referPatient);
router.get('/discharged-patients', restrictTo('doctor', 'staff'), getDischargedPatients);
router.get('/check-lab-results/:patientId', restrictTo('doctor', 'staff'), checkLabResults);
router.get('/ward-beds', restrictTo('doctor', 'staff'), getWardBeds);
router.get('/check-new-results', restrictTo('doctor', 'staff'), checkNewResults);

// ==================== SCHEDULE ROUTE ====================
router.get('/my-schedule', protect, restrictTo('doctor', 'staff'), getDoctorSchedule);
router.get('/staff-schedules', protect, restrictTo('doctor', 'staff'), getAllStaffSchedules);

// ==================== REPORT ROUTES FOR DOCTORS ====================
router.get('/reports/inbox', restrictTo('doctor', 'staff'), getDoctorReportsInbox);
router.get('/reports/outbox', restrictTo('doctor', 'staff'), getDoctorReportsOutbox);
router.get('/reports/unread-count', restrictTo('doctor', 'staff'), getDoctorUnreadReportCount);
router.get('/reports/:id', restrictTo('doctor', 'staff'), getDoctorReportById);
router.post('/reports/send', restrictTo('doctor', 'staff'), upload.array('attachments', 10), sendDoctorReport);
router.post('/reports/:id/reply', restrictTo('doctor', 'staff'), upload.single('attachment'), replyToDoctorReport);
router.put('/reports/:id/read', restrictTo('doctor', 'staff'), markDoctorReportRead);
router.get('/hospital-admins', restrictTo('doctor', 'staff'), getHospitalAdminsForDoctor);
router.get('/hospital-staff', restrictTo('doctor', 'staff'), getHospitalStaffForDoctor);

// ==================== PROFILE MANAGEMENT ROUTES ====================
router.get('/profile', isDoctor, getDoctorProfile);
router.put('/profile', isDoctor, updateDoctorProfile);
router.put('/change-password', isDoctor, changeDoctorPassword);

// ==================== REMINDER ROUTES ====================
router.post('/reports/:id/reminder', restrictTo('doctor', 'staff'), setReportReminder);
router.get('/reports/reminders', restrictTo('doctor', 'staff'), getDoctorReminders);

export default router;