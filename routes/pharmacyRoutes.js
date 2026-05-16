// routes/pharmacyRoutes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  getPendingPrescriptions,
  getPrescriptionById,
  preparePrescription,
  dispensePrescription,
  cancelPrescription,
  getInventory,
  updateInventory,
  addInventory,
  getLowStock,
  getTodayStats,
  getPharmacyProfile,
  updatePharmacyProfile,
  changePharmacyPassword,
  getHospitalAdminsForPharmacy,
  getPharmacyReportsInbox,
  getPharmacyReportsOutbox,
  sendPharmacyReport,
  replyToPharmacyReport,
  markPharmacyReportRead,
  upload
} from '../controllers/pharmacyController.js';

const router = express.Router();

// ==================== PRESCRIPTION ROUTES ====================
router.get('/pending', protect, restrictTo('pharmacy', 'pharmacist', 'pharma', 'hospital_admin'), getPendingPrescriptions);
router.get('/prescription/:id', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), getPrescriptionById);
router.put('/prepare/:id', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), preparePrescription);
router.put('/dispense/:id', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), dispensePrescription);
router.put('/cancel/:id', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), cancelPrescription);

// ==================== INVENTORY ROUTES ====================
router.get('/inventory', protect, restrictTo('pharmacy', 'pharmacist', 'pharma', 'hospital_admin'), getInventory);
router.put('/inventory/:id', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), updateInventory);
router.post('/inventory', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), addInventory);
router.get('/low-stock', protect, restrictTo('pharmacy', 'pharmacist', 'pharma', 'hospital_admin'), getLowStock);
router.get('/stats/today', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), getTodayStats);

// ==================== PROFILE ROUTES ====================
router.get('/profile', protect, getPharmacyProfile);
router.put('/profile', protect, updatePharmacyProfile);
router.put('/change-password', protect, changePharmacyPassword);

// ==================== REPORT ROUTES ====================
router.get('/hospital-admins', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), getHospitalAdminsForPharmacy);
router.get('/reports/inbox', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), getPharmacyReportsInbox);
router.get('/reports/outbox', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), getPharmacyReportsOutbox);
router.post('/reports/send', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), upload.array('attachments', 5), sendPharmacyReport);
router.post('/reports/:id/reply', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), upload.single('attachment'), replyToPharmacyReport);
router.put('/reports/:id/read', protect, restrictTo('pharmacy', 'pharmacist', 'pharma'), markPharmacyReportRead);

export default router;