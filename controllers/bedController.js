// backend/controllers/bedController.js
import Bed from '../models/Bed.js';
import Admission from '../models/Admission.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ==================== MULTER CONFIGURATION ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/reports';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bed-report-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
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

// ==================== HELPER FUNCTIONS ====================
const calculateOccupancyRate = (total, occupied) => {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100);
};

// ==================== BED MANAGEMENT FUNCTIONS ====================

// @desc    Get available beds by ward
export const getAvailableBeds = async (req, res) => {
  try {
    const { ward, hospital_id } = req.query;
    const hospitalId = hospital_id || req.user?.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const beds = await Bed.findAll({
      where: {
        hospital_id: hospitalId,
        ward: ward,
        status: 'available'
      },
      order: [['number', 'ASC']],
      attributes: ['id', 'number', 'type', 'notes']
    });

    res.json({ success: true, beds, count: beds.length });
  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all beds
export const getAllBeds = async (req, res) => {
  try {
    const { ward, status, type, hospital_id } = req.query;
    const hospitalId = hospital_id || req.user?.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const whereClause = { hospital_id: hospitalId };
    if (ward) whereClause.ward = ward;
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;

    const beds = await Bed.findAll({
      where: whereClause,
      order: [['ward', 'ASC'], ['number', 'ASC']],
      attributes: ['id', 'number', 'ward', 'type', 'status', 'notes', 'current_patient_name', 'current_patient_id', 'last_cleaned_at', 'last_occupied_at', 'createdAt', 'updatedAt']
    });

    res.json({ success: true, beds, count: beds.length });
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get bed by ID
export const getBedById = async (req, res) => {
  try {
    const { id } = req.params;
    const bed = await Bed.findByPk(id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }
    res.json({ success: true, bed });
  } catch (error) {
    console.error('Error fetching bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register new bed
export const registerBed = async (req, res) => {
  try {
    const { number, ward, type, notes, hospital_id } = req.body;
    const hospitalId = hospital_id || req.user?.hospital_id;
    const staffId = req.user.id;

    if (!number || !ward || !hospitalId) {
      return res.status(400).json({ success: false, message: 'Bed number, ward, and hospital_id are required' });
    }

    const validWards = ['OPD', 'EME', 'ANC'];
    if (!validWards.includes(ward)) {
      return res.status(400).json({ success: false, message: `Invalid ward. Must be one of: ${validWards.join(', ')}` });
    }

    const existingBed = await Bed.findOne({
      where: { hospital_id: hospitalId, ward, number }
    });

    if (existingBed) {
      return res.status(400).json({ success: false, message: `Bed ${number} already exists in ${ward} ward` });
    }

    const newBed = await Bed.create({
      hospital_id: hospitalId,
      number,
      ward,
      type: type || 'general',
      status: 'available',
      notes: notes || '',
      last_cleaned_at: new Date(),
      created_by: staffId
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_bed_management`).emit('new_bed_added', {
        bed_id: newBed.id,
        bed_number: number,
        ward: ward,
        hospital_id: hospitalId
      });
    }

    res.status(201).json({ success: true, message: `Bed ${number} registered successfully`, bed: newBed });
  } catch (error) {
    console.error('Error registering bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update bed status
export const updateBedStatus = async (req, res) => {
  try {
    const { bedId } = req.params;
    const { status, notes } = req.body;
    const staffId = req.user.id;

    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved', 'cleaning'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const bed = await Bed.findByPk(bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    const previousStatus = bed.status;
    const bedNumber = bed.number;
    const hospitalId = bed.hospital_id;

    await bed.update({
      status,
      notes: notes || bed.notes,
      updated_by: staffId,
      updated_at: new Date()
    });

    if (status === 'available' && previousStatus === 'maintenance') {
      await bed.update({ last_cleaned_at: new Date() });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_bed_management`).emit('bed_status_updated', {
        bed_id: bed.id,
        bed_number: bedNumber,
        status: status,
        old_status: previousStatus
      });
    }

    res.json({ success: true, message: `Bed status updated to ${status}`, bed, previous_status: previousStatus });
  } catch (error) {
    console.error('Error updating bed status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign bed to patient
export const assignBed = async (req, res) => {
  try {
    const { bed_id, patient_id, patient_name, doctor_name, ward, hospital_id, reason } = req.body;
    const hospitalId = hospital_id || req.user?.hospital_id;

    const bed = await Bed.findByPk(bed_id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status !== 'available') {
      return res.status(400).json({ success: false, message: `Bed is not available (current status: ${bed.status})` });
    }

    await bed.update({
      status: 'occupied',
      current_patient_id: patient_id,
      current_patient_name: patient_name,
      last_occupied_at: new Date(),
      updated_at: new Date()
    });

    const admission = await Admission.create({
      patient_id,
      patient_name,
      doctor_name,
      hospital_id: hospitalId,
      ward: ward || bed.ward,
      bed_id: bed.id,
      bed_number: bed.number,
      admitted_at: new Date(),
      status: 'active',
      reason: reason || 'Medical admission'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_bed_management`).emit('bed_occupied', {
        bed_id: bed.id,
        bed_number: bed.number,
        patient_id,
        patient_name,
        ward: bed.ward,
        admission_id: admission.id
      });
    }

    res.json({ success: true, message: 'Bed assigned successfully', bed, admission });
  } catch (error) {
    console.error('Error assigning bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Release bed
export const releaseBed = async (req, res) => {
  try {
    const { bed_id, reason, discharge_notes } = req.body;

    const bed = await Bed.findByPk(bed_id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    const previousPatient = {
      patient_id: bed.current_patient_id,
      patient_name: bed.current_patient_name
    };

    await Admission.update(
      { status: 'discharged', discharged_at: new Date(), discharge_summary: discharge_notes || reason },
      { where: { bed_id: bed.id, status: 'active' } }
    );

    await bed.update({
      status: 'cleaning',
      current_patient_id: null,
      current_patient_name: null,
      notes: reason ? `Released: ${reason}` : bed.notes,
      updated_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${bed.hospital_id}_bed_management`).emit('bed_released', {
        bed_id: bed.id,
        bed_number: bed.number,
        ward: bed.ward,
        previous_patient: previousPatient
      });
    }

    res.json({ success: true, message: 'Bed released successfully', bed, previous_patient: previousPatient });
  } catch (error) {
    console.error('Error releasing bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clean bed
export const cleanBed = async (req, res) => {
  try {
    const { bed_id } = req.body;

    const bed = await Bed.findByPk(bed_id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status !== 'cleaning' && bed.status !== 'maintenance') {
      return res.status(400).json({ success: false, message: `Bed must be in cleaning or maintenance status to clean` });
    }

    await bed.update({
      status: 'available',
      last_cleaned_at: new Date(),
      updated_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${bed.hospital_id}_bed_management`).emit('bed_cleaned', {
        bed_id: bed.id,
        bed_number: bed.number,
        ward: bed.ward
      });
    }

    res.json({ success: true, message: 'Bed marked as cleaned', bed });
  } catch (error) {
    console.error('Error cleaning bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get ward statistics
export const getWardStats = async (req, res) => {
  try {
    const { hospital_id } = req.query;
    const hospitalId = hospital_id || req.user?.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const wards = ['OPD', 'EME', 'ANC'];
    const stats = [];

    for (const ward of wards) {
      const total = await Bed.count({ where: { hospital_id: hospitalId, ward } });
      const available = await Bed.count({ where: { hospital_id: hospitalId, ward, status: 'available' } });
      const occupied = await Bed.count({ where: { hospital_id: hospitalId, ward, status: 'occupied' } });
      const maintenance = await Bed.count({ where: { hospital_id: hospitalId, ward, status: 'maintenance' } });
      const reserved = await Bed.count({ where: { hospital_id: hospitalId, ward, status: 'reserved' } });
      const cleaning = await Bed.count({ where: { hospital_id: hospitalId, ward, status: 'cleaning' } });
      
      const occupancyRate = calculateOccupancyRate(total, occupied);

      stats.push({
        ward,
        total,
        available,
        occupied,
        maintenance,
        reserved,
        cleaning,
        occupancyRate
      });
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching ward stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get bed logs
export const getBedLogs = async (req, res) => {
  try {
    const { bedId } = req.params;
    const { limit = 50 } = req.query;

    const bed = await Bed.findByPk(bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    const admissions = await Admission.findAll({
      where: { bed_id: bedId },
      order: [['admitted_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({ success: true, bed, admissions, count: admissions.length });
  } catch (error) {
    console.error('Error fetching bed logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete bed
export const deleteBed = async (req, res) => {
  try {
    const { bedId } = req.params;

    const bed = await Bed.findByPk(bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status === 'occupied') {
      return res.status(400).json({ success: false, message: 'Cannot delete an occupied bed' });
    }

    await bed.destroy();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${bed.hospital_id}_bed_management`).emit('bed_deleted', {
        bed_id: bedId,
        bed_number: bed.number,
        ward: bed.ward
      });
    }

    res.json({ success: true, message: 'Bed deleted successfully' });
  } catch (error) {
    console.error('Error deleting bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PROFILE FUNCTIONS ====================

export const getBedManagementProfile = async (req, res) => {
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
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBedManagementProfile = async (req, res) => {
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
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeBedManagementPassword = async (req, res) => {
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

// ==================== REPORT FUNCTIONS ====================

export const getHospitalAdminsForBedManagement = async (req, res) => {
  try {
    // The HospitalAdmin model likely has 'id' as the hospital ID
    // So we need to find the admin where id equals the hospital_id
    const hospitalAdmin = await HospitalAdmin.findByPk(req.user.hospital_id, {
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    let admins = [];
    
    if (hospitalAdmin) {
      admins = [{
        id: hospitalAdmin.id,
        full_name: `${hospitalAdmin.first_name} ${hospitalAdmin.middle_name ? hospitalAdmin.middle_name + ' ' : ''}${hospitalAdmin.last_name}`.trim(),
        email: hospitalAdmin.email,
        hospital_name: hospitalAdmin.hospital_name,
        hospital_id: hospitalAdmin.id
      }];
    } else {
      // Fallback: Use the current staff as the admin
      admins = [{
        id: req.user.id,
        full_name: `${req.user.first_name} ${req.user.middle_name ? req.user.middle_name + ' ' : ''}${req.user.last_name}`.trim(),
        email: req.user.email,
        hospital_name: req.user.hospital_name,
        hospital_id: req.user.hospital_id
      }];
    }
    
    res.json({ success: true, admins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    // Always return a default admin
    res.json({ 
      success: true, 
      admins: [{
        id: req.user.hospital_id || 1,
        full_name: 'Hospital Administrator',
        email: 'admin@hospital.com',
        hospital_name: req.user.hospital_name || 'General Hospital',
        hospital_id: req.user.hospital_id || 1
      }]
    });
  }
};
export const getBedManagementReportsInbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff'
      },
      order: [['sent_at', 'DESC']]
    });
    
    const unreadCount = reports.filter(r => !r.is_opened).length;
    res.json({ success: true, reports, unreadCount });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBedManagementReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: {
        sender_id: req.user.id,
        sender_type: 'staff'
      },
      order: [['sent_at', 'DESC']]
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendBedManagementReport = async (req, res) => {
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
      io.to(`hospital_${recipient.id}_admin`).emit('new_report_from_bed_management', {
        report_id: report.id,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToBedManagementReport = async (req, res) => {
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
      io.to(`staff_${parentReport.sender_id}`).emit('report_reply_from_bed_management', {
        report_id: reply.id,
        title: reply.title,
        sender_name: `${sender.first_name} ${sender.last_name}`
      });
    }

    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Reply to report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markBedManagementReportRead = async (req, res) => {
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