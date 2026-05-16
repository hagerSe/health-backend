// backend/controllers/labController.js
import LabRequest from '../models/LabRequest.js';
import LabResult from '../models/LabResult.js';
import Patient from '../models/Patient.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import Schedule from '../models/Schedule.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

// ==================== HELPER FUNCTIONS ====================

// Format staff full name with middle name
const formatFullName = (staff) => {
  if (!staff) return 'Unknown';
  const firstName = staff.first_name || '';
  const middleName = staff.middle_name ? ` ${staff.middle_name}` : '';
  const lastName = staff.last_name || '';
  return `${firstName}${middleName} ${lastName}`.trim();
};

// Get shift display name
const getShiftDisplayName = (shiftType) => {
  const shifts = {
    morning: { name: 'Morning', start: '08:00', end: '14:00', hours: 6, icon: '🌅' },
    afternoon: { name: 'Afternoon', start: '14:00', end: '20:00', hours: 6, icon: '☀️' },
    night: { name: 'Night', start: '20:00', end: '08:00', hours: 12, icon: '🌙' }
  };
  return shifts[shiftType] || { name: shiftType, start: '--:--', end: '--:--', hours: 0, icon: '📅' };
};

// Send notification to staff
const sendStaffNotification = async (staffId, hospitalId, title, message, type, priority = 'medium', data = {}) => {
  try {
    const notification = await Notification.create({
      recipient_id: staffId,
      recipient_type: 'staff',
      hospital_id: hospitalId,
      title,
      message,
      type,
      priority,
      data,
      is_read: false
    });
    console.log(`✅ Notification sent to staff ${staffId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

// ==================== LAB REQUESTS ====================

// @desc    Get all lab requests
// @route   GET /api/lab/pending
// @access  Private
export const getLabRequests = async (req, res) => {
  try {
    const { hospital_id, status, ward } = req.query;
    
    console.log('🔬 Lab dashboard fetching requests for hospital:', hospital_id);
    console.log('📊 Filtering by ward:', ward || 'All');

    if (!hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'hospital_id is required'
      });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id)
    };

    if (ward && ward !== 'all' && ward !== 'undefined') {
      whereClause.ward = ward;
      console.log(`📌 Filtering by ward: ${ward}`);
    }

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (status && status !== 'all' && validStatuses.includes(status)) {
      whereClause.status = status;
    }

    console.log('🔍 Where clause:', whereClause);

    const requests = await LabRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'first_name', 'middle_name', 'last_name', 'gender', 'age', 'phone', 'card_number']
        },
        {
          model: LabResult,
          as: 'result',
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log(`📊 Found ${requests.length} lab requests`);

    const formattedRequests = requests.map(req => {
      const data = req.toJSON();
      const patient = data.patient;
      return {
        id: data.id,
        request_number: data.request_number,
        patient_id: data.patient_id,
        patient_name: patient ? `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`.trim() : data.patient_name,
        patient_gender: patient?.gender || 'male',
        patient_age: patient?.age,
        patient_card: patient?.card_number,
        doctor_id: data.doctor_id,
        doctor_name: data.doctor_name,
        ward: data.ward,
        hospital_id: data.hospital_id,
        test_type: data.test_type,
        test_name: data.test_name,
        priority: data.priority,
        status: data.status,
        notes: data.notes,
        requested_at: data.requested_at,
        started_at: data.started_at,
        completed_at: data.completed_at,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
        has_result: !!data.result,
        critical: data.result?.critical || false,
        result: data.result ? {
          id: data.result.id,
          result: data.result.result,
          critical: data.result.critical,
          recommendations: data.result.recommendations,
          reported_at: data.result.reported_at,
          reported_by: data.result.reported_by
        } : null
      };
    });

    res.json({
      success: true,
      requests: formattedRequests,
      count: formattedRequests.length
    });

  } catch (error) {
    console.error('❌ Error fetching lab requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching lab requests',
      error: error.message 
    });
  }
};

// @desc    Get single lab request
// @route   GET /api/lab/requests/:id
// @access  Private
export const getLabRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await LabRequest.findByPk(id, {
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'first_name', 'middle_name', 'last_name', 'gender', 'age', 'phone']
        },
        {
          model: LabResult,
          as: 'result',
          required: false
        },
        {
          model: HospitalStaff,
          as: 'requester_staff',
          attributes: ['id', 'first_name', 'middle_name', 'last_name', 'department'],
          required: false
        }
      ]
    });

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab request not found' 
      });
    }

    res.json({
      success: true,
      request
    });

  } catch (error) {
    console.error('❌ Error fetching lab request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching lab request',
      error: error.message 
    });
  }
};

// @desc    Start processing a lab request
// @route   POST /api/lab/start/:id
// @access  Private
export const startProcessing = async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_id, technician_name } = req.body;

    console.log(`🔧 Starting processing for lab request: ${id}`);

    if (!technician_id || !technician_name) {
      return res.status(400).json({
        success: false,
        message: 'technician_id and technician_name are required'
      });
    }

    const request = await LabRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab request not found' 
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot process request with status: ${request.status}. Only pending requests can be processed.`
      });
    }

    await request.update({
      status: 'processing',
      processed_by: technician_id,
      technician_name: technician_name,
      started_at: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ Lab request ${id} status updated to: processing`);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${request.hospital_id}_lab`).emit('lab_status_update', {
        request_id: request.id,
        patient_name: request.patient_name,
        status: 'processing',
        test_name: request.test_name
      });
      
      io.to(`hospital_${request.hospital_id}_ward_${request.ward}`).emit('lab_status_update', {
        request_id: request.id,
        patient_id: request.patient_id,
        patient_name: request.patient_name,
        status: 'processing',
        test_name: request.test_name
      });

      if (request.doctor_id) {
        io.to(`hospital_${request.hospital_id}_doctor_${request.doctor_id}`).emit('lab_status_update', {
          request_id: request.id,
          patient_id: request.patient_id,
          patient_name: request.patient_name,
          status: 'processing',
          test_name: request.test_name
        });
      }
    }

    res.json({
      success: true,
      message: 'Processing started successfully',
      request: {
        id: request.id,
        status: request.status,
        started_at: request.started_at
      }
    });

  } catch (error) {
    console.error('❌ Error starting processing:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error starting processing',
      error: error.message 
    });
  }
};

// @desc    Collect sample
// @route   POST /api/lab/collect/:id
// @access  Private
export const collectSample = async (req, res) => {
  try {
    const { id } = req.params;
    const { technician_id, technician_name } = req.body;

    console.log(`🧪 Collect sample for request ${id}`);

    if (!technician_id || !technician_name) {
      return res.status(400).json({
        success: false,
        message: 'technician_id and technician_name are required'
      });
    }

    const request = await LabRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab request not found' 
      });
    }

    await request.update({
      status: 'processing',
      processed_by: technician_id,
      technician_name: technician_name,
      started_at: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ Sample collected - request ${id} status: processing`);

    res.json({
      success: true,
      message: 'Sample collected - request is now processing',
      request: {
        id: request.id,
        status: request.status
      }
    });

  } catch (error) {
    console.error('❌ Error collecting sample:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error collecting sample',
      error: error.message 
    });
  }
};

// @desc    Submit lab results
// @route   POST /api/lab/results/:id
// @access  Private
export const submitResults = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      results, 
      recommendations, 
      critical, 
      critical_values,
      technician_id,
      technician_name 
    } = req.body;

    console.log(`📝 Submitting results for lab request: ${id}`);

    if (!technician_id || !technician_name) {
      return res.status(400).json({
        success: false,
        message: 'technician_id and technician_name are required'
      });
    }

    if (!results) {
      return res.status(400).json({
        success: false,
        message: 'results are required'
      });
    }

    const labRequest = await LabRequest.findByPk(id);

    if (!labRequest) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab request not found' 
      });
    }

    if (labRequest.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Lab request is already completed'
      });
    }

    let resultsString = results;
    if (typeof results === 'object') {
      resultsString = JSON.stringify(results);
    }

    let labResult = await LabResult.findOne({
      where: { request_id: id }
    });

    if (labResult) {
      await labResult.update({
        result: resultsString,
        recommendations: recommendations || '',
        critical: critical || false,
        reported_by: technician_name,
        reported_at: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Updated existing result for request ${id}`);
    } else {
      labResult = await LabResult.create({
        request_id: id,
        patient_id: labRequest.patient_id,
        patient_name: labRequest.patient_name,
        test_name: labRequest.test_name,
        hospital_id: labRequest.hospital_id,
        doctor_id: labRequest.doctor_id,
        doctor_name: labRequest.doctor_name,
        ward: labRequest.ward,
        status: 'completed',
        result: resultsString,
        recommendations: recommendations || '',
        critical: critical || false,
        reported_by: technician_name,
        reported_at: new Date(),
        processed_by: technician_id
      });
      console.log(`✅ Created new result for request ${id}`);
    }

    await labRequest.update({
      status: 'completed',
      completed_at: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ Results submitted for request ${id}`);

    const io = req.app.get('io');
    if (io) {
      if (labRequest.doctor_id) {
        io.to(`hospital_${labRequest.hospital_id}_doctor_${labRequest.doctor_id}`).emit('lab_result_ready', {
          patient_id: labRequest.patient_id,
          patient_name: labRequest.patient_name,
          test_name: labRequest.test_name,
          doctor_id: labRequest.doctor_id,
          doctor_name: labRequest.doctor_name,
          critical: critical || false,
          result_id: labResult.id,
          request_id: id,
          status: 'completed',
          reported_at: new Date()
        });
        console.log(`📢 Notified doctor ${labRequest.doctor_id}`);
      }

      io.to(`hospital_${labRequest.hospital_id}_ward_${labRequest.ward}`).emit('lab_result_ready', {
        patient_id: labRequest.patient_id,
        patient_name: labRequest.patient_name,
        test_name: labRequest.test_name,
        doctor_id: labRequest.doctor_id,
        critical: critical || false,
        result_id: labResult.id,
        request_id: id
      });

      io.to(`hospital_${labRequest.hospital_id}_lab`).emit('lab_result_submitted', {
        request_id: id,
        patient_name: labRequest.patient_name,
        test_name: labRequest.test_name,
        status: 'completed'
      });

      if (critical) {
        io.to(`hospital_${labRequest.hospital_id}_alerts`).emit('critical_lab_result', {
          patient_id: labRequest.patient_id,
          patient_name: labRequest.patient_name,
          test_name: labRequest.test_name,
          doctor_name: labRequest.doctor_name,
          doctor_id: labRequest.doctor_id,
          critical_values: critical_values || 'Abnormal values detected',
          ward: labRequest.ward,
          request_id: id
        });
      }
    }

    res.json({
      success: true,
      message: 'Results submitted successfully',
      result: {
        id: labResult.id,
        result: labResult.result,
        critical: labResult.critical,
        reported_at: labResult.reported_at
      }
    });

  } catch (error) {
    console.error('❌ Error submitting results:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting results',
      error: error.message 
    });
  }
};

// @desc    Get lab statistics
// @route   GET /api/lab/stats
// @access  Private
export const getLabStats = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    if (!hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'hospital_id is required'
      });
    }

    const whereClause = { 
      hospital_id: parseInt(hospital_id) 
    };

    if (ward && ward !== 'all' && ward !== 'undefined') {
      whereClause.ward = ward;
    }

    const [pending, processing, completed] = await Promise.all([
      LabRequest.count({ where: { ...whereClause, status: 'pending' } }).catch(() => 0),
      LabRequest.count({ where: { ...whereClause, status: 'processing' } }).catch(() => 0),
      LabRequest.count({ where: { ...whereClause, status: 'completed' } }).catch(() => 0)
    ]);

    let critical = 0;
    try {
      const completedRequests = await LabRequest.findAll({
        where: { ...whereClause, status: 'completed' },
        attributes: ['id']
      });
      
      const completedIds = completedRequests.map(r => r.id);
      
      if (completedIds.length > 0) {
        critical = await LabResult.count({
          where: {
            request_id: { [Op.in]: completedIds },
            critical: true
          }
        }).catch(() => 0);
      }
    } catch (err) {
      console.error('Error counting critical results:', err);
    }

    const total = pending + processing + completed;

    console.log(`📊 Lab stats for hospital ${hospital_id}${ward ? ` (${ward} ward)` : ''}: pending=${pending}, processing=${processing}, completed=${completed}, critical=${critical}`);

    res.json({
      success: true,
      stats: {
        pending: pending || 0,
        processing: processing || 0,
        completed: completed || 0,
        critical: critical || 0,
        total: total || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching lab stats:', error);
    res.json({
      success: true,
      stats: {
        pending: 0,
        processing: 0,
        completed: 0,
        critical: 0,
        total: 0
      }
    });
  }
};

// @desc    Cancel a lab request
// @route   POST /api/lab/cancel/:id
// @access  Private
export const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cancelled_by } = req.body;

    console.log(`❌ Cancelling lab request: ${id}`);

    const request = await LabRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lab request not found' 
      });
    }

    if (!['pending', 'processing'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel request with status: ${request.status}`
      });
    }

    await request.update({
      status: 'cancelled',
      cancellation_reason: reason || 'No reason provided',
      cancelled_by: cancelled_by,
      cancelled_at: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ Lab request ${id} cancelled`);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${request.hospital_id}_lab`).emit('lab_request_cancelled', {
        request_id: request.id,
        patient_name: request.patient_name
      });
      
      if (request.doctor_id) {
        io.to(`hospital_${request.hospital_id}_doctor_${request.doctor_id}`).emit('lab_request_cancelled', {
          request_id: request.id,
          patient_name: request.patient_name,
          reason: reason
        });
      }
    }

    res.json({
      success: true,
      message: 'Lab request cancelled successfully',
      request: {
        id: request.id,
        status: request.status
      }
    });

  } catch (error) {
    console.error('❌ Error cancelling request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error cancelling request',
      error: error.message 
    });
  }
};

// ==================== STAFF PROFILE MANAGEMENT ====================

// @desc    Get lab staff profile
// @route   GET /api/lab/profile
// @access  Private
export const getLabProfile = async (req, res) => {
  try {
    const staff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: "Staff not found" 
      });
    }
    
    res.json({ 
      success: true, 
      staff: {
        ...staff.toJSON(),
        full_name: formatFullName(staff)
      }
    });
  } catch (error) {
    console.error("Get lab profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Update lab staff profile
// @route   PUT /api/lab/profile
// @access  Private
export const updateLabProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: "Staff not found" 
      });
    }
    
    await staff.update({
      first_name: first_name || staff.first_name,
      middle_name: middle_name !== undefined ? middle_name : staff.middle_name,
      last_name: last_name || staff.last_name,
      gender: gender || staff.gender,
      age: age || staff.age,
      phone: phone !== undefined ? phone : staff.phone
    });
    
    const updatedStaff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      staff: updatedStaff,
      message: "Profile updated successfully" 
    });
  } catch (error) {
    console.error("Update lab profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Change lab staff password
// @route   PUT /api/lab/change-password
// @access  Private
export const changeLabPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: "Staff not found" 
      });
    }
    
    const isMatch = await bcrypt.compare(current_password, staff.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await staff.update({ password: hashedPassword });
    
    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== REPORT MANAGEMENT ====================

// @desc    Get lab reports inbox
// @route   GET /api/lab/reports/inbox
// @access  Private
export const getLabReportsInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
        { sender_full_name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    
    const reports = await Report.findAll({
      where: whereClause,
      order: [['sent_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const unreadCount = await Report.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        is_opened: false
      }
    });
    
    res.json({
      success: true,
      reports,
      unreadCount,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error("Get lab reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get lab reports outbox
// @route   GET /api/lab/reports/outbox
// @access  Private
export const getLabReportsOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      sender_id: req.user.id,
      sender_type: 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
        { recipient_full_name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    
    const reports = await Report.findAll({
      where: whereClause,
      order: [['sent_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      reports,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error("Get lab reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send lab report to hospital admin
// @route   POST /api/lab/reports/send
// @access  Private
export const sendLabReport = async (req, res) => {
  try {
    const { title, subject, body, priority, recipient_type, recipient_id } = req.body;

    const sender = await HospitalStaff.findByPk(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    let recipient = null;
    let recipientFullName = '';
    
    if (recipient_type === 'hospital_admin') {
      recipient = await HospitalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = formatFullName(recipient);
      }
    }

    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({ order: [['id', 'DESC']], attributes: ['report_number'] });
    
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
      else nextNumber = (await Report.count()) + 1;
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

    let attachments = [];
    if (req.files && req.files.length > 0) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      attachments = req.files.map(file => ({
        name: file.originalname,
        url: `${baseUrl}/uploads/reports/${file.filename}`,
        type: file.mimetype,
        size: file.size,
        uploaded_at: new Date()
      }));
    }

    const report = await Report.create({
      report_number,
      title,
      subject: subject || title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      attachments,
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      sender_title: `Lab Technician - ${sender.department || 'Laboratory'} Department`,
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipient.hospital_name,
      recipient_hospital_id: recipient.id,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      const adminRoom = `hospital_${recipient.id}_admin`;
      io.to(adminRoom).emit('new_report_from_lab', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: formatFullName(sender),
        sender_department: sender.department,
        sent_at: report.sent_at
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send lab report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reply to report from lab
// @route   POST /api/lab/reports/:id/reply
// @access  Private
export const replyToLabReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const isParticipant = (
      (parentReport.sender_id === req.user.id && parentReport.sender_type === 'staff') ||
      (parentReport.recipient_id === req.user.id && parentReport.recipient_type === 'staff')
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized to reply" });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const recipientId = parentReport.sender_id === req.user.id ? parentReport.recipient_id : parentReport.sender_id;
    const recipientType = parentReport.sender_id === req.user.id ? parentReport.recipient_type : parentReport.sender_type;

    let recipientFirstName = '';
    let recipientMiddleName = '';
    let recipientLastName = '';
    let recipientFullName = '';
    let recipientHospitalId = null;
    let recipientHospitalName = '';

    if (recipientType === 'hospital') {
      const hospitalAdmin = await HospitalAdmin.findByPk(recipientId);
      if (hospitalAdmin) {
        recipientFirstName = hospitalAdmin.first_name || '';
        recipientMiddleName = hospitalAdmin.middle_name || '';
        recipientLastName = hospitalAdmin.last_name || '';
        recipientFullName = formatFullName(hospitalAdmin);
        recipientHospitalId = hospitalAdmin.id;
        recipientHospitalName = hospitalAdmin.hospital_name || '';
      }
    } else if (recipientType === 'staff') {
      const staffMember = await HospitalStaff.findByPk(recipientId);
      if (staffMember) {
        recipientFirstName = staffMember.first_name || '';
        recipientMiddleName = staffMember.middle_name || '';
        recipientLastName = staffMember.last_name || '';
        recipientFullName = formatFullName(staffMember);
        recipientHospitalId = staffMember.hospital_id;
        recipientHospitalName = staffMember.hospital_name || '';
      }
    }

    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({ order: [['id', 'DESC']], attributes: ['report_number'] });
    
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
      else nextNumber = (await Report.count()) + 1;
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

    let attachment = null;
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      attachment = {
        name: req.file.originalname,
        url: `${baseUrl}/uploads/reports/${req.file.filename}`,
        type: req.file.mimetype,
        size: req.file.size,
        uploaded_at: new Date()
      };
    }

    const attachments = attachment ? [attachment] : [];

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject,
      body,
      priority: parentReport.priority,
      status: 'sent',
      attachments,
      
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      sender_title: `Lab Technician - ${sender.department || 'Laboratory'} Department`,
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      sender_department: sender.department,
      
      recipient_id: recipientId,
      recipient_type: recipientType,
      recipient_first_name: recipientFirstName,
      recipient_middle_name: recipientMiddleName,
      recipient_last_name: recipientLastName,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipientHospitalName,
      recipient_hospital_id: recipientHospitalId,
      
      parent_report_id: parentReport.id,
      thread_id: parentReport.thread_id || parentReport.id,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    await parentReport.update({ 
      status: 'replied', 
      last_activity_at: new Date(),
      reply_count: (parentReport.reply_count || 0) + 1
    });

    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      
      if (recipientType === 'hospital') {
        recipientRoom = `hospital_${recipientHospitalId}_admin`;
      } else if (recipientType === 'staff') {
        recipientRoom = `hospital_${recipientHospitalId}_staff_${recipientId}`;
      }
      
      io.to(recipientRoom).emit('report_reply_from_lab', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: formatFullName(sender),
        sender_department: sender.department,
        sent_at: reply.sent_at,
        body_preview: body.substring(0, 100),
        body: body,
        has_attachments: attachments.length > 0,
        is_reply: true
      });
    }

    res.json({ 
      success: true, 
      reply, 
      message: "Reply sent successfully" 
    });
  } catch (error) {
    console.error("Lab reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mark lab report as read
// @route   PUT /api/lab/reports/:id/read
// @access  Private
export const markLabReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        recipient_id: req.user.id,
        recipient_type: 'staff'
      }
    });

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    await report.update({
      is_opened: true,
      opened_at: new Date(),
      opened_count: (report.opened_count || 0) + 1
    });

    res.json({ success: true, message: "Report marked as read" });
  } catch (error) {
    console.error("Mark report read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get hospital admins for lab
// @route   GET /api/lab/hospital-admins
// @access  Private
export const getHospitalAdminsForLab = async (req, res) => {
  try {
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { id: req.user.hospital_id },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    const formattedAdmins = hospitalAdmins.map(admin => ({
      id: admin.id,
      full_name: formatFullName(admin),
      email: admin.email,
      hospital_name: admin.hospital_name,
      hospital_id: admin.id
    }));
    
    res.json({ success: true, admins: formattedAdmins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STAFF SCHEDULE VIEWING ====================

// @desc    Get my upcoming schedule
// @route   GET /api/lab/my-schedule
// @access  Private
export const getMyLabSchedule = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;

    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.gte]: new Date() }
      },
      order: [['date', 'ASC']],
      limit: parseInt(days)
    });

    let totalHours = 0;
    const shiftsByType = { morning: 0, afternoon: 0, night: 0 };
    
    schedules.forEach(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      totalHours += shift.hours;
      shiftsByType[schedule.shift_type]++;
    });

    const processedSchedules = schedules.map(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      return {
        id: schedule.id,
        date: schedule.date,
        date_formatted: new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_icon: shift.icon,
        start_time: shift.start,
        end_time: shift.end,
        hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status
      };
    });

    res.json({
      success: true,
      staff: {
        id: req.user.id,
        full_name: formatFullName(req.user),
        department: req.user.department,
        ward: req.user.ward,
        role: req.user.role
      },
      summary: {
        total_shifts: schedules.length,
        total_hours: totalHours,
        shifts_by_type: shiftsByType,
        upcoming_shifts: schedules.length,
        next_shift: schedules.length > 0 ? {
          date: schedules[0].date,
          shift_name: getShiftDisplayName(schedules[0].shift_type).name,
          ward: schedules[0].ward,
          hours: getShiftDisplayName(schedules[0].shift_type).hours
        } : null
      },
      schedules: processedSchedules
    });
  } catch (error) {
    console.error('Error fetching my schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my weekly schedule
// @route   GET /api/lab/weekly-schedule
// @access  Private
export const getMyLabWeeklySchedule = async (req, res) => {
  try {
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;
    
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [startOfWeek, endOfWeek] }
      },
      order: [['date', 'ASC']]
    });

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weeklyView = [];
    let totalHours = 0;

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const daySchedules = schedules.filter(s => new Date(s.date).toDateString() === currentDate.toDateString());
      
      let dayTotalHours = 0;
      const shifts = daySchedules.map(s => {
        const shift = getShiftDisplayName(s.shift_type);
        dayTotalHours += shift.hours;
        totalHours += shift.hours;
        return {
          id: s.id,
          shift_type: s.shift_type,
          shift_name: shift.name,
          shift_icon: shift.icon,
          start_time: shift.start,
          end_time: shift.end,
          hours: shift.hours,
          ward: s.ward,
          status: s.status
        };
      });

      weeklyView.push({
        day: daysOfWeek[i],
        date: currentDate,
        date_formatted: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        is_today: currentDate.toDateString() === new Date().toDateString(),
        shifts: shifts,
        total_hours: dayTotalHours,
        has_shifts: shifts.length > 0
      });
    }

    res.json({
      success: true,
      week_range: {
        start: startOfWeek,
        end: endOfWeek,
        start_formatted: startOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        end_formatted: endOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      },
      total_hours: totalHours,
      total_shifts: schedules.length,
      weekly_view: weeklyView,
      schedules: schedules.map(s => ({
        id: s.id,
        date: s.date,
        shift_name: getShiftDisplayName(s.shift_type).name,
        shift_icon: getShiftDisplayName(s.shift_type).icon,
        start_time: getShiftDisplayName(s.shift_type).start,
        end_time: getShiftDisplayName(s.shift_type).end,
        hours: getShiftDisplayName(s.shift_type).hours,
        ward: s.ward,
        status: s.status
      }))
    });
  } catch (error) {
    console.error('Error fetching weekly schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my today's schedule
// @route   GET /api/lab/today-schedule
// @access  Private
export const getMyLabTodaySchedule = async (req, res) => {
  try {
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [today, tomorrow] }
      },
      order: [['shift_type', 'ASC']]
    });

    let currentShift = null;
    let upcomingShift = null;
    const now = new Date();
    const currentHour = now.getHours();

    schedules.forEach(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      const [startHour] = shift.start.split(':').map(Number);
      const [endHour] = shift.end.split(':').map(Number);
      
      const scheduleData = {
        id: schedule.id,
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_icon: shift.icon,
        start_time: shift.start,
        end_time: shift.end,
        hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status,
        is_ongoing: currentHour >= startHour && currentHour < (endHour < startHour ? endHour + 24 : endHour),
        is_upcoming: currentHour < startHour
      };

      if (scheduleData.is_ongoing) {
        currentShift = scheduleData;
      } else if (scheduleData.is_upcoming && !upcomingShift) {
        upcomingShift = scheduleData;
      }
    });

    res.json({
      success: true,
      date: today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      has_schedule: schedules.length > 0,
      current_shift: currentShift,
      upcoming_shift: upcomingShift,
      all_shifts: schedules.map(s => {
        const shift = getShiftDisplayName(s.shift_type);
        return {
          id: s.id,
          shift_name: shift.name,
          shift_icon: shift.icon,
          start_time: shift.start,
          end_time: shift.end,
          hours: shift.hours,
          ward: s.ward,
          status: s.status
        };
      })
    });
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my schedule statistics
// @route   GET /api/lab/schedule-stats
// @access  Private
export const getMyLabScheduleStats = async (req, res) => {
  try {
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const nextWeekStart = new Date(startOfWeek);
    nextWeekStart.setDate(startOfWeek.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);
    
    const thisWeekSchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [startOfWeek, endOfWeek] }
      }
    });
    
    const nextWeekSchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [nextWeekStart, nextWeekEnd] }
      }
    });
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todaySchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [today, tomorrow] }
      }
    });
    
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const upcomingSchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [tomorrow, next7Days] }
      }
    });
    
    const calculateHours = (schedules) => {
      let hours = 0;
      schedules.forEach(s => { hours += getShiftDisplayName(s.shift_type).hours; });
      return hours;
    };
    
    res.json({
      success: true,
      stats: {
        today: {
          has_schedule: todaySchedules.length > 0,
          shift_count: todaySchedules.length,
          total_hours: calculateHours(todaySchedules)
        },
        this_week: {
          shift_count: thisWeekSchedules.length,
          total_hours: calculateHours(thisWeekSchedules),
          week_range: `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`
        },
        next_week: {
          shift_count: nextWeekSchedules.length,
          total_hours: calculateHours(nextWeekSchedules),
          week_range: `${nextWeekStart.toLocaleDateString()} - ${nextWeekEnd.toLocaleDateString()}`
        },
        upcoming: {
          shift_count: upcomingSchedules.length,
          total_hours: calculateHours(upcomingSchedules),
          next_shift: upcomingSchedules.length > 0 ? {
            date: upcomingSchedules[0].date,
            shift_name: getShiftDisplayName(upcomingSchedules[0].shift_type).name,
            ward: upcomingSchedules[0].ward
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my notifications
// @route   GET /api/lab/notifications
// @access  Private
export const getMyLabNotifications = async (req, res) => {
  try {
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'
    };
    
    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    const unreadCount = await Notification.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        is_read: false
      }
    });
    
    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};