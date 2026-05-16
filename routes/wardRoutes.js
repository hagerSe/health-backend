import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js'; // ✅ ADD restrictTo here
import {
  getWardPatients,
  startConsultation,
  completeConsultation,
  getPatientHistory,
  getWardStats
} from '../controllers/wardController.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// OPD Doctor routes
router.get('/opd/patients', restrictTo('opd_doctor', 'hospital_admin'), (req, res) => {
  req.params.ward = 'OPD';
  return getWardPatients(req, res);
});

router.get('/opd/stats', restrictTo('opd_doctor', 'hospital_admin'), (req, res) => {
  req.params.ward = 'OPD';
  return getWardStats(req, res);
});

// EME Doctor routes
router.get('/eme/patients', restrictTo('eme_doctor', 'hospital_admin'), (req, res) => {
  req.params.ward = 'EME';
  return getWardPatients(req, res);
});

router.get('/eme/stats', restrictTo('eme_doctor', 'hospital_admin'), (req, res) => {
  req.params.ward = 'EME';
  return getWardStats(req, res);
});

// ANC Nurse routes
router.get('/anc/patients', restrictTo('anc_nurse', 'hospital_admin'), (req, res) => {
  req.params.ward = 'ANC';
  return getWardPatients(req, res);
});

router.get('/anc/stats', restrictTo('anc_nurse', 'hospital_admin'), (req, res) => {
  req.params.ward = 'ANC';
  return getWardStats(req, res);
});

// Common consultation routes (accessible by all ward staff)
router.post('/patient/:patientId/start', startConsultation);
router.post('/patient/:patientId/complete', completeConsultation);
router.get('/patient/:patientId/history', getPatientHistory);

export default router;