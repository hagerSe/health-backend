// const express = require('express');
// const router = express.Router();
// const { authenticateToken } = require('../middleware/auth');
// const { upload } = require('../server');
// const path = require('path');
// const fs = require('fs');

// // Mock database for radiology requests
// let radiologyRequests = [
//   {
//     id: 'rad_1',
//     patient_id: 'p_123',
//     patient_name: 'Abebe Kebede',
//     doctor_id: 'dr_456',
//     doctor_name: 'Tadesse',
//     ward: 'OPD',
//     examType: 'X-ray',
//     bodyPart: 'Chest',
//     priority: 'urgent',
//     status: 'pending',
//     notes: 'Cough, rule out pneumonia',
//     created_at: new Date().toISOString()
//   },
//   {
//     id: 'rad_2',
//     patient_id: 'p_125',
//     patient_name: 'Worku Desta',
//     doctor_id: 'dr_458',
//     doctor_name: 'Gebre',
//     ward: 'EME',
//     examType: 'CT Scan',
//     bodyPart: 'Head',
//     priority: 'stat',
//     status: 'in_progress',
//     notes: 'Head trauma, rule out bleed',
//     created_at: new Date().toISOString()
//   }
// ];

// // Completed radiology reports
// let radiologyReports = [];

// // GET /api/radiology/requests - Get all radiology requests (filter by ward)
// router.get('/requests', authenticateToken, (req, res) => {
//   try {
//     const { ward } = req.query;
//     let filteredRequests = [...radiologyRequests];
    
//     if (ward && ward !== 'all') {
//       filteredRequests = filteredRequests.filter(r => r.ward === ward);
//     }
    
//     // Sort by priority and date
//     filteredRequests.sort((a, b) => {
//       const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
//       const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
//       if (priorityDiff !== 0) return priorityDiff;
//       return new Date(b.created_at) - new Date(a.created_at);
//     });
    
//     res.json({
//       success: true,
//       requests: filteredRequests
//     });
//   } catch (error) {
//     console.error('Error fetching radiology requests:', error);
//     res.status(500).json({ success: false, message: 'Error fetching requests' });
//   }
// });

// // GET /api/radiology/request/:id - Get single radiology request
// router.get('/request/:id', authenticateToken, (req, res) => {
//   try {
//     const request = radiologyRequests.find(r => r.id === req.params.id);
//     if (!request) {
//       return res.status(404).json({ success: false, message: 'Request not found' });
//     }
    
//     res.json({
//       success: true,
//       request
//     });
//   } catch (error) {
//     console.error('Error fetching request:', error);
//     res.status(500).json({ success: false, message: 'Error fetching request' });
//   }
// });

// // POST /api/radiology/start/:id - Start exam
// router.post('/start/:id', authenticateToken, (req, res) => {
//   try {
//     const request = radiologyRequests.find(r => r.id === req.params.id);
//     if (!request) {
//       return res.status(404).json({ success: false, message: 'Request not found' });
//     }
    
//     request.status = 'in_progress';
//     request.started_at = new Date().toISOString();
//     request.started_by = req.user?.id || 'tech_1';
    
//     res.json({
//       success: true,
//       message: 'Exam started',
//       request
//     });
//   } catch (error) {
//     console.error('Error starting exam:', error);
//     res.status(500).json({ success: false, message: 'Error starting exam' });
//   }
// });

// // POST /api/radiology/upload-image - Upload radiology image
// router.post('/upload-image', authenticateToken, upload.array('images', 10), (req, res) => {
//   try {
//     const files = req.files;
    
//     if (!files || files.length === 0) {
//       return res.status(400).json({ success: false, message: 'No files uploaded' });
//     }
    
//     const imageUrls = files.map(file => ({
//       filename: file.filename,
//       url: `/uploads/${file.filename}`,
//       originalName: file.originalname,
//       size: file.size
//     }));
    
//     res.json({
//       success: true,
//       message: 'Images uploaded successfully',
//       images: imageUrls
//     });
//   } catch (error) {
//     console.error('Error uploading images:', error);
//     res.status(500).json({ success: false, message: 'Error uploading images' });
//   }
// });

// // POST /api/radiology/report/:id - Submit radiology report
// router.post('/report/:id', authenticateToken, (req, res) => {
//   try {
//     const { report, images, radiologist_id, radiologist_name } = req.body;
//     const requestId = req.params.id;
    
//     const request = radiologyRequests.find(r => r.id === requestId);
//     if (!request) {
//       return res.status(404).json({ success: false, message: 'Request not found' });
//     }
    
//     // Create report entry
//     const radiologyReport = {
//       id: 'rep_' + Date.now(),
//       request_id: requestId,
//       patient_id: request.patient_id,
//       patient_name: request.patient_name,
//       examType: request.examType,
//       bodyPart: request.bodyPart,
//       report: report,
//       images: images || [],
//       radiologist_name: radiologist_name || req.user?.full_name || 'Radiologist',
//       reported_at: new Date().toISOString(),
//       status: 'completed'
//     };
    
//     radiologyReports.push(radiologyReport);
    
//     // Update request status
//     request.status = 'completed';
//     request.completed_at = new Date().toISOString();
//     request.report_id = radiologyReport.id;
    
//     res.json({
//       success: true,
//       message: 'Report submitted successfully',
//       report: radiologyReport
//     });
//   } catch (error) {
//     console.error('Error submitting report:', error);
//     res.status(500).json({ success: false, message: 'Error submitting report' });
//   }
// });

// // GET /api/radiology/reports/patient/:patientId - Get reports for a patient
// router.get('/reports/patient/:patientId', authenticateToken, (req, res) => {
//   try {
//     const patientReports = radiologyReports.filter(r => r.patient_id === req.params.patientId);
    
//     res.json({
//       success: true,
//       results: patientReports
//     });
//   } catch (error) {
//     console.error('Error fetching patient reports:', error);
//     res.status(500).json({ success: false, message: 'Error fetching reports' });
//   }
// });

// // GET /api/radiology/templates - Get report templates
// router.get('/templates', authenticateToken, (req, res) => {
//   const templates = {
//     'X-ray': {
//       technique: 'Standard AP and lateral views',
//       findings: '',
//       impression: '',
//       recommendations: ''
//     },
//     'Ultrasound': {
//       technique: 'Real-time sonography with linear and convex transducers',
//       findings: '',
//       impression: '',
//       recommendations: ''
//     },
//     'CT Scan': {
//       technique: 'Helical acquisition with IV contrast',
//       findings: '',
//       impression: '',
//       recommendations: ''
//     },
//     'MRI': {
//       technique: 'Multiplanar multisequence imaging',
//       findings: '',
//       impression: '',
//       recommendations: ''
//     }
//   };
  
//   res.json({
//     success: true,
//     templates
//   });
// });

// // GET /api/radiology/stats - Get radiology statistics
// router.get('/stats', authenticateToken, (req, res) => {
//   try {
//     const stats = {
//       total: radiologyRequests.length,
//       pending: radiologyRequests.filter(r => r.status === 'pending').length,
//       in_progress: radiologyRequests.filter(r => r.status === 'in_progress').length,
//       completed: radiologyRequests.filter(r => r.status === 'completed').length,
//       stat: radiologyRequests.filter(r => r.priority === 'stat').length,
//       urgent: radiologyRequests.filter(r => r.priority === 'urgent').length,
//       routine: radiologyRequests.filter(r => r.priority === 'routine').length
//     };
    
//     res.json({
//       success: true,
//       stats
//     });
//   } catch (error) {
//     console.error('Error fetching stats:', error);
//     res.status(500).json({ success: false, message: 'Error fetching stats' });
//   }
// });

// module.exports = router;