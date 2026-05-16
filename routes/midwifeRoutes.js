// routes/midwifeRoutes.js
import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getPatients,
  getStats,
  assignPatient,
  saveAntenatalRecord,
  getAntenatalVisits,
  recordDelivery,
  getDeliveries,
  updateRiskStatus,
  saveDiagnosis,
  savePrescriptions,
  requestLabTest,
  getLabResults,
  getDischargedPatients,
  dischargePatient,
  getAvailableBeds,
  admitPatient,
  referPatient,
  getProfile,
  updateProfile,
  changePassword,
  getReportsInbox,
  getReportsOutbox,
  sendReport,
  markReportAsRead,
  replyToReport,
  getHospitalAdmins
} from '../controllers/midwifeController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Patient management
router.get('/patients', getPatients);
router.get('/stats', getStats);
router.post('/assign-patient', assignPatient);

// Antenatal care
router.post('/save-antenatal', saveAntenatalRecord);
router.get('/antenatal-visits/:patientId', getAntenatalVisits);

// Delivery
router.post('/record-delivery', recordDelivery);
router.get('/deliveries', getDeliveries);

// Risk management
router.put('/update-risk-status/:patientId', updateRiskStatus);

// Diagnosis and prescriptions
router.post('/save-diagnosis', saveDiagnosis);
router.post('/save-prescriptions', savePrescriptions);

// Lab management
router.post('/request-lab', requestLabTest);
router.get('/lab-results/:patientId', getLabResults);

// Discharge management
router.get('/discharged-patients', getDischargedPatients);
router.post('/discharge-patient', dischargePatient);

// Bed management and admission
router.get('/available-beds', getAvailableBeds);
router.post('/admit-patient', admitPatient);

// Referral
router.post('/refer-patient', referPatient);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

// Reports
router.get('/reports/inbox', getReportsInbox);
router.get('/reports/outbox', getReportsOutbox);
router.post('/reports/send', sendReport);
router.put('/reports/:reportId/read', markReportAsRead);
router.post('/reports/:reportId/reply', replyToReport);
router.get('/hospital-admins', getHospitalAdmins);

export default router;