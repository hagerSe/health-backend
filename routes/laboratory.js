// const express = require('express');
// const router = express.Router();
// const { authenticateToken } = require('../middleware/auth');

// // Mock database for lab requests
// let labRequests = [
//   {
//     id: 'lab_1',
//     patient_id: 'p_123',
//     patient_name: 'Abebe Kebede',
//     patient_gender: 'male',
//     patient_age: 45,
//     doctor_id: 'dr_456',
//     doctor_name: 'Tadesse',
//     ward: 'OPD',
//     testType: 'blood',
//     testName: 'CBC (Complete Blood Count)',
//     priority: 'urgent',
//     status: 'pending',
//     notes: 'Fever for 3 days, rule out infection',
//     created_at: new Date().toISOString(),
//     sample_collected: false
//   },
//   {
//     id: 'lab_2',
//     patient_id: 'p_124',
//     patient_name: 'Almaz Haile',
//     patient_gender: 'female',
//     patient_age: 30,
//     doctor_id: 'dr_457',
//     doctor_name: 'Hailu',
//     ward: 'OPD',
//     testType: 'urine',
//     testName: 'Urinalysis',
//     priority: 'routine',
//     status: 'in_progress',
//     notes: 'Urinary symptoms',
//     created_at: new Date().toISOString(),
//     sample_collected: true,
//     collected_at: new Date().toISOString()
//   },
//   {
//     id: 'lab_3',
//     patient_id: 'p_125',
//     patient_name: 'Worku Desta',
//     patient_gender: 'male',
//     patient_age: 60,
//     doctor_id: 'dr_458',
//     doctor_name: 'Gebre',
//     ward: 'EME',
//     testType: 'blood',
//     testName: 'Blood Chemistry',
//     priority: 'stat',
//     status: 'pending',
//     notes: 'Chest pain, rule out MI',
//     created_at: new Date().toISOString(),
//     sample_collected: false
//   }
// ];

// // Completed lab results
// let labResults = [];

// // GET /api/laboratory/requests - Get all lab requests (filter by ward)
// router.get('/requests', authenticateToken, (req, res) => {
//   try {
//     const { ward } = req.query;
//     let filteredRequests = [...labRequests];
    
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
//     console.error('Error fetching lab requests:', error);
//     res.status(500).json({ success: false, message: 'Error fetching lab requests' });
//   }
// });

// // GET /api/laboratory/request/:id - Get single lab request
// router.get('/request/:id', authenticateToken, (req, res) => {
//   try {
//     const request = labRequests.find(r => r.id === req.params.id);
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

// // POST /api/laboratory/start/:id - Start processing lab request
// router.post('/start/:id', authenticateToken, (req, res) => {
//   try {
//     const request = labRequests.find(r => r.id === req.params.id);
//     if (!request) {
//       return res.status(404).json({ success: false, message: 'Request not found' });
//     }
    
//     request.status = 'in_progress';
//     request.started_at = new Date().toISOString();
//     request.started_by = req.user?.id || 'tech_1';
    
//     res.json({
//       success: true,
//       message: 'Request marked as in progress',
//       request
//     });
//   } catch (error) {
//     console.error('Error starting request:', error);
//     res.status(500).json({ success: false, message: 'Error starting request' });
//   }
// });

// // POST /api/laboratory/collect/:id - Mark sample as collected
// router.post('/collect/:id', authenticateToken, (req, res) => {
//   try {
//     const request = labRequests.find(r => r.id === req.params.id);
//     if (!request) {
//       return res.status(404).json({ success: false, message: 'Request not found' });
//     }
    
//     request.sample_collected = true;
//     request.collected_at = new Date().toISOString();
//     request.collected_by = req.user?.id || 'tech_1';
    
//     res.json({
//       success: true,
//       message: 'Sample collected',
//       request
//     });
//   } catch (error) {
//     console.error('Error collecting sample:', error);
//     res.status(500).json({ success: false, message: 'Error collecting sample' });
//   }
// });

// // POST /api/laboratory/results/:id - Submit lab results
// router.post('/results/:id', authenticateToken, (req, res) => {
//   try {
//     const { results, recommendations, critical, critical_values } = req.body;
//     const requestId = req.params.id;
    
//     const request = labRequests.find(r => r.id === requestId);
//     if (!request) {
//       return res.status(404).json({ success: false, message: 'Request not found' });
//     }
    
//     // Create result entry
//     const result = {
//       id: 'res_' + Date.now(),
//       request_id: requestId,
//       patient_id: request.patient_id,
//       patient_name: request.patient_name,
//       testName: request.testName,
//       testType: request.testType,
//       results,
//       recommendations,
//       critical: critical || false,
//       critical_values: critical_values || [],
//       reported_by: req.user?.full_name || 'Lab Technician',
//       reported_at: new Date().toISOString(),
//       status: 'completed'
//     };
    
//     labResults.push(result);
    
//     // Update request status
//     request.status = 'completed';
//     request.completed_at = new Date().toISOString();
//     request.result_id = result.id;
    
//     res.json({
//       success: true,
//       message: 'Results submitted successfully',
//       result
//     });
//   } catch (error) {
//     console.error('Error submitting results:', error);
//     res.status(500).json({ success: false, message: 'Error submitting results' });
//   }
// });

// // GET /api/laboratory/results/patient/:patientId - Get results for a patient
// router.get('/results/patient/:patientId', authenticateToken, (req, res) => {
//   try {
//     const patientResults = labResults.filter(r => r.patient_id === req.params.patientId);
    
//     res.json({
//       success: true,
//       results: patientResults
//     });
//   } catch (error) {
//     console.error('Error fetching patient results:', error);
//     res.status(500).json({ success: false, message: 'Error fetching results' });
//   }
// });

// // GET /api/laboratory/stats - Get lab statistics
// router.get('/stats', authenticateToken, (req, res) => {
//   try {
//     const stats = {
//       total: labRequests.length,
//       pending: labRequests.filter(r => r.status === 'pending').length,
//       in_progress: labRequests.filter(r => r.status === 'in_progress').length,
//       completed: labRequests.filter(r => r.status === 'completed').length,
//       stat: labRequests.filter(r => r.priority === 'stat').length,
//       urgent: labRequests.filter(r => r.priority === 'urgent').length,
//       routine: labRequests.filter(r => r.priority === 'routine').length
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