// backend/controllers/cardofficeController.js

import Patient from '../models/Patient.js';
import Visit from '../models/Visit.js';
import Notification from '../models/Notification.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import Schedule from '../models/Schedule.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
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

export const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
    }
  }
});

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

// Generate visit number
const generateVisitNumber = async () => {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayCount = await Visit.count({
      where: {
        created_at: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });
    
    const sequence = String(todayCount + 1).padStart(4, '0');
    const visitNumber = `VIS-${dateStr}-${sequence}`;
    return visitNumber;
  } catch (error) {
    console.error('Error generating visit number:', error);
    return `VIS-${Date.now()}`;
  }
};

// ==================== REGISTER NEW PATIENT ====================
export const registerPatient = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      age,
      gender,
      phone,
      hospital_id
    } = req.body;

    if (!first_name || !last_name || !age || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const currentHospitalId = hospital_id;
    
    if (!currentHospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID is required'
      });
    }

    const year = new Date().getFullYear();
    
    const lastPatient = await Patient.findOne({
      where: { hospital_id: parseInt(currentHospitalId) },
      order: [['createdAt', 'DESC']],
      attributes: ['card_number']
    });
    
    let sequence = 1;
    if (lastPatient && lastPatient.card_number) {
      const parts = lastPatient.card_number.split('/');
      if (parts.length === 2) {
        const lastNumber = parseInt(parts[1]);
        if (!isNaN(lastNumber)) {
          sequence = lastNumber + 1;
        }
      }
    }
    
    const card_number = `${year}/${String(sequence).padStart(4, '0')}`;

    const patient = await Patient.create({
      card_number,
      first_name,
      middle_name,
      last_name,
      age,
      gender,
      phone,
      hospital_id: parseInt(currentHospitalId),
      status: 'in_triage',
      registered_at: new Date(),
      registered_by: req.user?.full_name || formatFullName(req.user) || 'Card Office Staff',
      registered_by_id: req.user?.id
    });

    const visitNumber = await generateVisitNumber();
    
    await Visit.create({
      patient_id: patient.id,
      hospital_id: parseInt(currentHospitalId),
      visit_number: visitNumber,
      visit_type: 'OPD',
      status: 'active',
      started_at: new Date()
    });

    await Notification.create({
      recipient_id: patient.id,
      recipient_type: 'triage_nurse',
      hospital_id: parseInt(currentHospitalId),
      title: 'New Patient Registered',
      message: `Patient ${first_name} ${last_name} is waiting for triage.`,
      type: 'new_patient',
      priority: 'medium',
      reference_id: patient.id,
      data: {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name}`,
        age,
        gender,
        phone
      }
    });

    const io = req.app.get('io');
    if (io) {
      const triageRoom = `hospital_${currentHospitalId}_triage`;
      io.to(triageRoom).emit('new_patient_registered', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name}`,
        age,
        gender,
        phone,
        status: 'in_triage',
        registered_at: new Date(),
        hospital_id: currentHospitalId
      });

      const cardOfficeRoom = `hospital_${currentHospitalId}_cardoffice`;
      io.to(cardOfficeRoom).emit('patient_registered', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${first_name} ${last_name}`,
        status: 'in_triage'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully and sent to triage',
      patient: {
        id: patient.id,
        card_number: patient.card_number,
        first_name: patient.first_name,
        middle_name: patient.middle_name,
        last_name: patient.last_name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        status: patient.status,
        registered_at: patient.registered_at
      }
    });

  } catch (error) {
    console.error('Patient registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SEARCH PATIENTS ====================
export const searchPatients = async (req, res) => {
  try {
    const { query } = req.query;
    const hospitalId = req.query.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital ID is required',
        patients: [],
        count: 0
      });
    }
    
    // Implementation here
    res.json({ success: true, patients: [], count: 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ==================== GET PATIENT BY ID ====================
export const getPatientById = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required' });
    }
    
    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: parseInt(hospitalId)
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const visits = await Visit.findAll({
      where: { patient_id: patient.id },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      patient,
      visits
    });

  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SEND RETURNING PATIENT TO TRIAGE ====================
export const sendToTriage = async (req, res) => {
  try {
    const { patientId, reason, hospital_id } = req.body;
    const currentHospitalId = hospital_id;

    if (!currentHospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required' });
    }

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: parseInt(currentHospitalId)
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    await patient.update({
      status: 'in_triage',
      return_reason: reason,
      returned_at: new Date()
    });

    const visitNumber = await generateVisitNumber();
    
    await Visit.create({
      patient_id: patient.id,
      hospital_id: parseInt(currentHospitalId),
      visit_number: visitNumber,
      visit_type: 'Follow-up',
      status: 'active',
      chief_complaint: reason,
      started_at: new Date(),
      is_return_visit: true
    });

    await Notification.create({
      recipient_id: patient.id,
      recipient_type: 'triage_nurse',
      hospital_id: parseInt(currentHospitalId),
      title: 'Returning Patient',
      message: `Patient ${patient.first_name} ${patient.last_name} has returned. Reason: ${reason}`,
      type: 'return_patient',
      priority: 'medium',
      reference_id: patient.id,
      data: {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`,
        reason,
        is_return: true
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${currentHospitalId}_triage`).emit('returning_patient', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`,
        reason,
        status: 'in_triage'
      });
    }

    res.json({
      success: true,
      message: 'Patient sent to triage successfully',
      patient
    });

  } catch (error) {
    console.error('Error sending to triage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET RECENT PATIENTS ====================
export const getRecentPatients = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital ID is required',
        patients: []
      });
    }
    
    const patients = await Patient.findAll({
      where: { hospital_id: parseInt(hospitalId) },
      order: [['registered_at', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      patients: patients || []
    });

  } catch (error) {
    console.error('Error fetching recent patients:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      patients: []
    });
  }
};

// ==================== GET DASHBOARD STATS ====================
export const getCardOfficeStats = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital ID is required',
        stats: { today: 0, inTriage: 0, active: 0, total: 0 }
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRegistrations = await Patient.count({
      where: {
        hospital_id: parseInt(hospitalId),
        registered_at: { [Op.gte]: today }
      }
    });

    const inTriage = await Patient.count({
      where: {
        hospital_id: parseInt(hospitalId),
        status: 'in_triage'
      }
    });

    const activePatients = await Patient.count({
      where: {
        hospital_id: parseInt(hospitalId),
        status: { [Op.in]: ['in_triage', 'in_opd', 'in_emergency', 'in_anc', 'with_doctor'] }
      }
    });

    const totalPatients = await Patient.count({
      where: { hospital_id: parseInt(hospitalId) }
    });

    res.json({
      success: true,
      stats: {
        today: todayRegistrations || 0,
        inTriage: inTriage || 0,
        active: activePatients || 0,
        total: totalPatients || 0
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stats: { today: 0, inTriage: 0, active: 0, total: 0 }
    });
  }
};

// ==================== UPDATE PATIENT ====================
export const updatePatient = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, phone } = req.body;
    const hospitalId = req.query.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required' });
    }

    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: parseInt(hospitalId)
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    await patient.update({
      first_name: first_name || patient.first_name,
      middle_name: middle_name !== undefined ? middle_name : patient.middle_name,
      last_name: last_name || patient.last_name,
      phone: phone !== undefined ? phone : patient.phone
    });

    res.json({
      success: true,
      message: 'Patient updated successfully',
      patient
    });

  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STAFF PROFILE MANAGEMENT ====================
export const getCardOfficeProfile = async (req, res) => {
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
    console.error("Get card office profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateCardOfficeProfile = async (req, res) => {
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
    console.error("Update card office profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const changeCardOfficePassword = async (req, res) => {
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

// ==================== REPORT MANAGEMENT (NO ATTACHMENTS) ====================

export const getHospitalAdminsForCardOffice = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital ID is required',
        admins: []
      });
    }
    
    const parsedHospitalId = parseInt(hospitalId);
    
    const hospitalAdmin = await HospitalAdmin.findOne({
      where: { 
        id: parsedHospitalId
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    let admins = [];
    if (hospitalAdmin) {
      admins = [hospitalAdmin];
      console.log(`✅ Found admin: ${hospitalAdmin.first_name} ${hospitalAdmin.last_name}`);
    } else {
      const anyAdmin = await HospitalAdmin.findOne({
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
      });
      if (anyAdmin) {
        admins = [anyAdmin];
        console.log(`✅ Using fallback admin: ${anyAdmin.first_name} ${anyAdmin.last_name}`);
      }
    }
    
    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      full_name: formatFullName(admin),
      first_name: admin.first_name || '',
      middle_name: admin.middle_name || '',
      last_name: admin.last_name || '',
      email: admin.email || '',
      hospital_name: admin.hospital_name || 'Hospital',
      hospital_id: admin.id
    }));
    
    res.json({ 
      success: true, 
      admins: formattedAdmins 
    });
    
  } catch (error) {
    console.error("❌ Get hospital admins error:", error);
    res.status(200).json({ 
      success: true, 
      admins: []
    });
  }
};

export const getCardOfficeReportsInbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { recipient_id: req.user.id, recipient_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    
    const unreadCount = reports.filter(r => !r.is_opened).length;
    res.json({ success: true, reports, unreadCount });
  } catch (error) {
    console.error("Get card office reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message, reports: [], unreadCount: 0 });
  }
};

export const getCardOfficeReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { sender_id: req.user.id, sender_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get card office reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message, reports: [] });
  }
};

export const sendCardOfficeReport = async (req, res) => {
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

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const report = await Report.create({
      report_number,
      title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      attachments: [], // No attachments
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: formatFullName(recipient),
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${recipient.id}_admin`).emit('new_report_from_cardoffice', {
        report_id: report.id,
        title: report.title,
        priority: report.priority,
        sender_name: formatFullName(sender)
      });
    }

    res.status(201).json({ 
      success: true, 
      report,
      message: "Report sent successfully" 
    });
  } catch (error) {
    console.error("Send card office report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToCardOfficeReport = async (req, res) => {
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

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      body,
      priority: parentReport.priority,
      status: 'sent',
      attachments: [], // No attachments
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      recipient_id: parentReport.sender_id,
      recipient_type: parentReport.sender_type,
      recipient_first_name: parentReport.sender_first_name,
      recipient_middle_name: parentReport.sender_middle_name,
      recipient_last_name: parentReport.sender_last_name,
      recipient_full_name: parentReport.sender_full_name,
      parent_report_id: parentReport.id,
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
      io.to(`staff_${parentReport.sender_id}`).emit('report_reply_from_cardoffice', {
        report_id: reply.id,
        title: reply.title,
        sender_name: formatFullName(sender)
      });
    }

    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Reply to card office report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markCardOfficeReportRead = async (req, res) => {
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

// ==================== SCHEDULE FUNCTIONS FOR CARD OFFICE ====================
export const getMyScheduleCardOffice = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const staffId = req.user.id;
    
    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        date: { [Op.gte]: new Date() }
      },
      order: [['date', 'ASC']],
      limit: parseInt(days)
    });

    let totalHours = 0;
    
    schedules.forEach(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      totalHours += shift.hours;
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySchedules = schedules.filter(s => {
      const sDate = new Date(s.date);
      return sDate >= today && sDate < tomorrow;
    });
    
    const todayHours = todaySchedules.reduce((sum, s) => sum + getShiftDisplayName(s.shift_type).hours, 0);

    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const thisWeekSchedules = schedules.filter(s => {
      const sDate = new Date(s.date);
      return sDate >= startOfWeek && sDate <= endOfWeek;
    });
    const thisWeekHours = thisWeekSchedules.reduce((sum, s) => sum + getShiftDisplayName(s.shift_type).hours, 0);

    res.json({
      success: true,
      schedules: processedSchedules,
      total_hours: totalHours,
      stats: {
        today: { shift_count: todaySchedules.length, total_hours: todayHours },
        this_week: { shift_count: thisWeekSchedules.length, total_hours: thisWeekHours }
      }
    });
  } catch (error) {
    console.error('Error fetching card office schedule:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      schedules: [],
      total_hours: 0
    });
  }
};