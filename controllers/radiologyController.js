// controllers/radiologyController.js - COMPLETELY FIXED
import RadiologyRequest from '../models/RadiologyRequest.js';
import RadiologyReport from '../models/RadiologyReport.js';
import Patient from '../models/Patient.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ==================== MULTER CONFIGURATION ====================
const radiologyDir = 'uploads/radiology';
if (!fs.existsSync(radiologyDir)) {
  fs.mkdirSync(radiologyDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/radiology';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `radiology-${uniqueSuffix}${ext}`);
  }
});

export const upload = multer({ 
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'image/dicom', 'application/dicom', 'image/dicom-rle'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(dcm|dicom)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and DICOM files are allowed.'));
    }
  }
});

// ==================== HELPER FUNCTIONS ====================
const generateRequestNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const todayCount = await RadiologyRequest.count({
    where: {
      createdAt: {
        [Op.between]: [startOfDay, endOfDay]
      }
    }
  });
  
  const sequence = String(todayCount + 1).padStart(4, '0');
  return `XR-${dateStr}-${sequence}`;
};

// ==================== RADIOLOGY REQUEST ROUTES ====================

// @desc    Get pending radiology requests
// @route   GET /api/radiology/pending
// @access  Private
// ==================== RADIOLOGY REQUEST ROUTES ====================

// @desc    Get pending radiology requests
// @route   GET /api/radiology/pending
// @access  Private
export const getPendingRequests = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    console.log(`🔍 Fetching pending requests - hospital: ${hospital_id}, ward: ${ward}`);

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id),
      status: 'pending'
    };

    if (ward && ward !== 'all') {
      whereClause.ward = ward;
    }

    // Simplified query - NO include
    const requests = await RadiologyRequest.findAll({
      where: whereClause,
      order: [['createdAt', 'ASC']],
      raw: true
    });

    console.log(`✅ Found ${requests.length} pending requests`);

    res.json({ success: true, requests, count: requests.length });
  } catch (error) {
    console.error('❌ Error fetching pending requests:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get in-progress radiology requests
// @route   GET /api/radiology/in-progress
// @access  Private
export const getInProgressRequests = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    console.log(`🔍 Fetching in-progress requests - hospital: ${hospital_id}, ward: ${ward}`);

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id),
      status: 'in_progress'
    };

    if (ward && ward !== 'all') {
      whereClause.ward = ward;
    }

    const requests = await RadiologyRequest.findAll({
      where: whereClause,
      order: [['started_at', 'ASC']],
      raw: true
    });

    console.log(`✅ Found ${requests.length} in-progress requests`);

    res.json({ success: true, requests, count: requests.length });
  } catch (error) {
    console.error('❌ Error fetching in-progress requests:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get completed radiology requests
// @route   GET /api/radiology/completed
// @access  Private
export const getCompletedRequests = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    console.log(`🔍 Fetching completed requests - hospital: ${hospital_id}, ward: ${ward}`);

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id),
      status: 'completed'
    };

    if (ward && ward !== 'all') {
      whereClause.ward = ward;
    }

    const requests = await RadiologyRequest.findAll({
      where: whereClause,
      order: [['completed_at', 'DESC']],
      raw: true
    });

    console.log(`✅ Found ${requests.length} completed requests`);

    res.json({ success: true, requests, count: requests.length });
  } catch (error) {
    console.error('❌ Error fetching completed requests:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get in-progress radiology requests
// @route   GET /api/radiology/in-progress
// @access  Private
// @desc    Get in-progress radiology requests
// @route   GET /api/radiology/in-progress
// @access  Private


// @desc    Get completed radiology requests
// @route   GET /api/radiology/completed
// @access  Private


// @desc    Start radiology exam
// @route   PUT /api/radiology/requests/:id/start
// @access  Private
export const startExam = async (req, res) => {
  try {
    const { id } = req.params;
    const staffName = req.user.full_name || `${req.user.first_name} ${req.user.last_name}`;

    const request = await RadiologyRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot start exam with status: ${request.status}` });
    }

    await request.update({
      status: 'in_progress',
      started_at: new Date(),
      started_by: staffName
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${request.hospital_id}_radiology`).emit('radiology_request_updated', {
        request_id: request.id,
        status: 'in_progress',
        patient_name: request.patient_name
      });
    }

    res.json({ success: true, message: 'Exam started successfully', request });
  } catch (error) {
    console.error('Error starting exam:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload images for radiology exam
// @route   POST /api/radiology/upload/:id
// @access  Private
export const uploadImages = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await RadiologyRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

   const baseUrl = process.env.NODE_ENV === 'production' 
  ? `https://${req.get('host')}`
  : `${req.protocol}://${req.get('host')}`;
  
    const newImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageData = {
          url: `${baseUrl}/uploads/radiology/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: req.user.full_name || `${req.user.first_name} ${req.user.last_name}`
        };
        newImages.push(imageData);
      }
    }

    res.json({ 
      success: true, 
      message: `${newImages.length} image(s) uploaded successfully`,
      images: newImages
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit radiology report
// @route   PUT /api/radiology/report/:id
// @access  Private
// @desc    Submit radiology report
// @route   PUT /api/radiology/report/:id
// @access  Private
// controllers/radiologyController.js - FIX submitReport function


// @desc    Get radiology report by request ID
// @route   GET /api/radiology/report/:id
// @access  Private

export const submitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { findings, impression, critical } = req.body;

    console.log(`📝 Submitting radiology report for request: ${id}`);
    console.log(`📎 Files received: ${req.files?.length || 0}`);

    const staffName = req.user.full_name || `${req.user.first_name} ${req.user.last_name}`.trim();
    const request = await RadiologyRequest.findByPk(id, { transaction });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // ✅ Process uploaded images
    let processedImages = [];
    if (req.files && req.files.length > 0) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      for (const file of req.files) {
        processedImages.push({
          url: `${baseUrl}/uploads/radiology/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploaded_at: new Date().toISOString(),
          uploaded_by: staffName
        });
      }
    }

    // ✅ Save or update report with images
    let radiologyReport = await RadiologyReport.findOne({
      where: { request_id: request.id },
      transaction
    });

    if (radiologyReport) {
      await radiologyReport.update({
        findings: findings || radiologyReport.findings,
        impression: impression || radiologyReport.impression,
        critical: critical === 'true' || critical === true,
        images: processedImages,
        status: 'completed',
        submitted_at: new Date(),
        reported_at: new Date(),
        reported_by: staffName
      }, { transaction });
    } else {
      radiologyReport = await RadiologyReport.create({
        request_id: request.id,
        patient_id: request.patient_id,
        patient_name: request.patient_name,
        doctor_id: request.doctor_id,
        doctor_name: request.doctor_name,
        radiologist_name: staffName,
        exam_type: request.exam_type,
        body_part: request.body_part,
        hospital_id: request.hospital_id,
        clinical_history: request.clinical_notes,
        findings: findings || '',
        impression: impression || '',
        critical: critical === 'true' || critical === true,
        images: processedImages,
        status: 'completed',
        submitted_at: new Date(),
        reported_at: new Date(),
        reported_by: staffName
      }, { transaction });
    }

    await request.update({
      status: 'completed',
      completed_at: new Date(),
      report_id: radiologyReport.id
    }, { transaction });

    await transaction.commit();

    // ✅ Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${request.hospital_id}_doctor_${request.doctor_id}`).emit('radiology_report_ready', {
        request_id: request.id,
        patient_name: request.patient_name,
        exam_type: request.exam_type,
        images_count: processedImages.length,
        critical: critical === 'true' || critical === true
      });
    }

    res.json({ 
      success: true, 
      message: 'Report submitted successfully',
      report: radiologyReport
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error submitting report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};  


export const getReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await RadiologyReport.findOne({
      where: { request_id: id },
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'first_name', 'last_name', 'gender', 'age', 'phone', 'card_number']
        },
        {
          model: HospitalStaff,
          as: 'doctor',
          attributes: ['id', 'first_name', 'last_name', 'department']
        },
        {
          model: HospitalStaff,
          as: 'radiologist',
          attributes: ['id', 'first_name', 'last_name', 'department']
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PROFILE ROUTES ====================

export const getRadiologyProfile = async (req, res) => {
  try {
    const staff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    
    res.json({ 
      success: true, 
      staff: {
        ...staff.toJSON(),
        full_name: `${staff.first_name} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name}`.trim()
      }
    });
  } catch (error) {
    console.error("Get radiology profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRadiologyProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
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
    
    res.json({ success: true, staff: updatedStaff, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update radiology profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeRadiologyPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    
    const isMatch = await bcrypt.compare(current_password, staff.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await staff.update({ password: hashedPassword });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT ROUTES ====================

export const getHospitalAdminsForRadiology = async (req, res) => {
  try {
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { id: req.user.hospital_id },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    const formattedAdmins = hospitalAdmins.map(admin => ({
      id: admin.id,
      full_name: `${admin.first_name} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name}`.trim(),
      email: admin.email,
      hospital_name: admin.hospital_name,
      hospital_id: admin.id
    }));
    
    res.json({ success: true, admins: formattedAdmins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.json({ success: true, admins: [] });
  }
};

export const getRadiologyReportsInbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { recipient_id: req.user.id, recipient_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    
    const unreadCount = reports.filter(r => !r.is_opened).length;
    res.json({ success: true, reports, unreadCount });
  } catch (error) {
    console.error("Get radiology reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRadiologyReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { sender_id: req.user.id, sender_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get radiology reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendRadiologyReport = async (req, res) => {
  try {
    const { title, body, priority, recipient_id } = req.body;

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const recipient = await HospitalAdmin.findByPk(recipient_id);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const report = await Report.create({
      report_number,
      title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.last_name}`,
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: `${recipient.first_name} ${recipient.last_name}`,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${recipient.id}_admin`).emit('new_report_from_radiology', {
        report_id: report.id,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send radiology report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToRadiologyReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      body,
      priority: parentReport.priority,
      status: 'sent',
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.last_name}`,
      recipient_id: parentReport.sender_id,
      recipient_type: parentReport.sender_type,
      recipient_first_name: parentReport.sender_first_name,
      recipient_last_name: parentReport.sender_last_name,
      recipient_full_name: parentReport.sender_full_name,
      parent_report_id: parentReport.id,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    await parentReport.update({ status: 'replied', last_activity_at: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.to(`staff_${parentReport.sender_id}`).emit('report_reply_from_radiology', {
        report_id: reply.id,
        title: reply.title,
        sender_name: `${sender.first_name} ${sender.last_name}`
      });
    }

    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Reply to radiology report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markRadiologyReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'staff' }
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