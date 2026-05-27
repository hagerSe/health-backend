// backend/controllers/triageController.js
import Patient from '../models/Patient.js';
import Visit from '../models/Visit.js';
import Notification from '../models/Notification.js';
import VitalSign from '../models/VitalSign.js';
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
  destination: (req, file, cb) => { cb(null, reportsDir); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `triage-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// ==================== HELPER FUNCTIONS ====================
const formatFullName = (staff) => {
  if (!staff) return 'Unknown';
  const firstName = staff.first_name || '';
  const middleName = staff.middle_name ? ` ${staff.middle_name}` : '';
  const lastName = staff.last_name || '';
  return `${firstName}${middleName} ${lastName}`.trim();
};

const getShiftDisplayName = (shiftType) => {
  const shifts = {
    morning: { name: 'Morning', start: '08:00', end: '14:00', hours: 6, icon: '🌅' },
    afternoon: { name: 'Afternoon', start: '14:00', end: '20:00', hours: 6, icon: '☀️' },
    night: { name: 'Night', start: '20:00', end: '08:00', hours: 12, icon: '🌙' }
  };
  return shifts[shiftType] || { name: shiftType, start: '--:--', end: '--:--', hours: 0, icon: '📅' };
};

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
      where: { created_at: { [Op.between]: [startOfDay, endOfDay] } }
    });
    
    const sequence = String(todayCount + 1).padStart(4, '0');
    return `VIS-${dateStr}-${sequence}`;
  } catch (error) {
    console.error('Error generating visit number:', error);
    return `VIS-${Date.now()}`;
  }
};

const determinePriority = (ward, vitals) => {
  let priority = 'routine';
  if (ward === 'EME') priority = 'urgent';
  
  if (vitals?.blood_pressure) {
    const systolic = parseInt(vitals.blood_pressure.split('/')[0]);
    if (systolic > 180) priority = 'critical';
    else if (systolic > 140) priority = 'high';
  }
  
  if (vitals?.oxygen_saturation) {
    const o2 = parseInt(vitals.oxygen_saturation);
    if (o2 < 90) priority = 'critical';
    else if (o2 < 94) priority = 'high';
  }
  
  if (vitals?.temperature) {
    const temp = parseFloat(vitals.temperature);
    if (temp > 39 || temp < 35) priority = 'critical';
    else if (temp > 38 || temp < 36) priority = 'high';
  }
  
  if (vitals?.heart_rate) {
    const hr = parseInt(vitals.heart_rate);
    if (hr > 120 || hr < 50) priority = 'critical';
    else if (hr > 100 || hr < 60) priority = 'high';
  }
  
  return priority;
};

const calculateBMI = (weight, height) => {
  if (weight && height && height > 0) {
    const heightInM = height / 100;
    return (weight / (heightInM * heightInM)).toFixed(1);
  }
  return null;
};

// ==================== TRIAGE QUEUE ====================
export const getTriageQueue = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required', patients: [] });
    }
    
    const patients = await Patient.findAll({
      where: { hospital_id: parseInt(hospitalId), status: 'in_triage' },
      order: [['registered_at', 'ASC']]
    });
    res.json({ success: true, patients: patients || [] });
  } catch (error) {
    console.error('Error getting triage queue:', error);
    res.status(500).json({ success: false, message: error.message, patients: [] });
  }
};

export const getTriagedPatients = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required', patients: [] });
    }
    
    const patients = await Patient.findAll({
      where: { hospital_id: parseInt(hospitalId), status: { [Op.in]: ['in_opd', 'in_emergency', 'in_anc'] } },
      order: [['triaged_at', 'DESC']],
      limit: 50
    });
    res.json({ success: true, patients: patients || [] });
  } catch (error) {
    console.error('Error getting triaged patients:', error);
    res.status(500).json({ success: false, message: error.message, patients: [] });
  }
};

// ==================== GET PATIENT BY ID FOR TRIAGE (ADDED - FIXES THE ERROR) ====================
export const getPatientForTriage = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    if (!hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital ID is required' 
      });
    }
    
    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: parseInt(hospitalId)
      }
    });

    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const visits = await Visit.findAll({
      where: { patient_id: patient.id },
      order: [['created_at', 'DESC']],
      limit: 5
    });

    res.json({ success: true, patient, visits });
  } catch (error) {
    console.error('Error getting patient for triage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== RECORD VITALS AND SEND TO WARD ====================
export const recordVitalsAndSendToWard = async (req, res) => {
  try {
    const { patientId, vitals, ward, notes } = req.body;
    const hospitalId = req.user.hospital_id;
    
    if (!patientId || !ward) {
      return res.status(400).json({ success: false, message: 'Patient ID and ward are required' });
    }

    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const statusMap = { 'OPD': 'in_opd', 'EME': 'in_emergency', 'ANC': 'in_anc' };
    const priority = determinePriority(ward, vitals);
    const bmi = calculateBMI(vitals.weight, vitals.height);

    await patient.update({
      vitals: { ...vitals, bmi, recorded_at: new Date(), recorded_by: formatFullName(req.user), recorded_by_id: req.user.id },
      triage_info: { 
        triaged_by: formatFullName(req.user), 
        triaged_by_id: req.user.id, 
        triaged_at: new Date(), 
        destination: ward, 
        ward, 
        priority, 
        notes: notes || vitals.chief_complaint 
      },
      status: statusMap[ward], 
      ward, 
      triaged_at: new Date()
    });

    const visitNumber = await generateVisitNumber();
    let visit = await Visit.findOne({ where: { patient_id: patient.id, status: 'active' } });

    if (visit) {
      await visit.update({
        status: 'active', 
        ward, 
        chief_complaint: vitals.chief_complaint || vitals.notes,
        triage_vitals: { ...vitals, bmi, priority }, 
        triage_nurse: formatFullName(req.user),
        triage_nurse_id: req.user.id, 
        triaged_at: new Date()
      });
    } else {
      const visitType = ward === 'OPD' ? 'OPD' : ward === 'EME' ? 'Emergency' : 'ANC';
      await Visit.create({
        patient_id: patient.id, 
        hospital_id: hospitalId, 
        visit_number: visitNumber, 
        ward,
        visit_type: visitType, 
        status: 'active', 
        chief_complaint: vitals.chief_complaint || vitals.notes,
        triage_vitals: { ...vitals, bmi, priority }, 
        triage_nurse: formatFullName(req.user),
        triage_nurse_id: req.user.id, 
        triaged_at: new Date(), 
        started_at: new Date()
      });
    }

    await VitalSign.create({
      patient_id: patient.id, 
      recorded_by_id: req.user.id, 
      recorded_by_name: formatFullName(req.user),
      blood_pressure: vitals.blood_pressure || null, 
      temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
      heart_rate: vitals.heart_rate ? parseInt(vitals.heart_rate) : null,
      respiratory_rate: vitals.respiratory_rate ? parseInt(vitals.respiratory_rate) : null,
      oxygen_saturation: vitals.oxygen_saturation ? parseInt(vitals.oxygen_saturation) : null,
      weight: vitals.weight ? parseFloat(vitals.weight) : null, 
      height: vitals.height ? parseFloat(vitals.height) : null,
      bmi: bmi ? parseFloat(bmi) : null, 
      pain_level: vitals.pain_level ? parseInt(vitals.pain_level) : null,
      consciousness: vitals.consciousness || 'Alert', 
      is_pregnant: vitals.is_pregnant || false,
      weeks_pregnant: vitals.weeks_pregnant ? parseInt(vitals.weeks_pregnant) : null,
      is_critical: priority === 'critical' || priority === 'urgent',
      notes: notes || vitals.chief_complaint || null
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_ward_${ward}`).emit('new_patient_in_ward', {
        patient_id: patient.id, 
        card_number: patient.card_number,
        patient_name: `${patient.first_name} ${patient.last_name}`, 
        age: patient.age, 
        gender: patient.gender,
        vitals: { ...vitals, bmi, priority }, 
        priority, 
        ward, 
        hospital_id: hospitalId,
        triage_nurse: formatFullName(req.user), 
        message: `New patient assigned to ${ward} Ward`, 
        timestamp: new Date()
      });
      io.to(`hospital_${hospitalId}_triage`).emit('patient_removed_from_triage', { patient_id: patient.id });
    }

    res.json({
      success: true,
      message: `Patient sent to ${ward} Ward successfully`,
      patient: { 
        id: patient.id, 
        card_number: patient.card_number, 
        first_name: patient.first_name, 
        last_name: patient.last_name, 
        status: patient.status, 
        ward: patient.ward, 
        triaged_at: patient.triaged_at 
      }
    });
  } catch (error) {
    console.error('Error in recordVitalsAndSendToWard:', error);
    res.status(500).json({ success: false, message: error.message || 'Error processing patient' });
  }
};

// ==================== GET TRIAGE DASHBOARD STATS ====================
export const getTriageStats = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required', stats: { waiting: 0, opd: 0, eme: 0, anc: 0 } });
    }
    
    const [waiting, opd, eme, anc] = await Promise.all([
      Patient.count({ where: { hospital_id: parseInt(hospitalId), status: 'in_triage' } }),
      Patient.count({ where: { hospital_id: parseInt(hospitalId), ward: 'OPD', status: 'in_opd' } }),
      Patient.count({ where: { hospital_id: parseInt(hospitalId), ward: 'EME', status: 'in_emergency' } }),
      Patient.count({ where: { hospital_id: parseInt(hospitalId), ward: 'ANC', status: 'in_anc' } })
    ]);
    
    res.json({ success: true, stats: { waiting, opd, eme, anc } });
  } catch (error) {
    console.error('Error getting triage stats:', error);
    res.status(500).json({ success: false, message: error.message, stats: { waiting: 0, opd: 0, eme: 0, anc: 0 } });
  }
};

// ==================== STAFF PROFILE MANAGEMENT ====================
export const getTriageProfile = async (req, res) => {
  try {
    const staff = await HospitalStaff.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    res.json({ success: true, staff: { ...staff.toJSON(), full_name: formatFullName(staff) } });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTriageProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone } = req.body;
    const staff = await HospitalStaff.findByPk(req.user.id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    
    await staff.update({
      first_name: first_name || staff.first_name, 
      middle_name: middle_name !== undefined ? middle_name : staff.middle_name,
      last_name: last_name || staff.last_name, 
      gender: gender || staff.gender,
      age: age || staff.age, 
      phone: phone !== undefined ? phone : staff.phone
    });
    
    const updatedStaff = await HospitalStaff.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, staff: updatedStaff, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeTriagePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const staff = await HospitalStaff.findByPk(req.user.id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    
    const isMatch = await bcrypt.compare(current_password, staff.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await staff.update({ password: hashedPassword });
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT ====================
// ✅ CORRECT - No 'export' here
const getHospitalAdminsForTriage = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required', admins: [] });
    }
    
    const parsedHospitalId = parseInt(hospitalId);
    
    const hospitalAdmin = await HospitalAdmin.findOne({
      where: { id: parsedHospitalId },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    const admins = hospitalAdmin ? [hospitalAdmin] : [];
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
    
    res.json({ success: true, admins: formattedAdmins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.status(200).json({ success: true, admins: [] });
  }
};

export const getTriageReportsInbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { recipient_id: req.user.id, recipient_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    const unreadCount = reports.filter(r => !r.is_opened).length;
    res.json({ success: true, reports, unreadCount });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: error.message, reports: [], unreadCount: 0 });
  }
};

export const getTriageReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { sender_id: req.user.id, sender_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get outbox error:", error);
    res.status(500).json({ success: false, message: error.message, reports: [] });
  }
};

export const sendTriageReport = async (req, res) => {
  try {
    const { title, body, priority, recipient_id } = req.body;
    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) return res.status(404).json({ success: false, message: "Sender not found" });

    const recipient = await HospitalAdmin.findByPk(recipient_id);
    if (!recipient) return res.status(404).json({ success: false, message: "Recipient not found" });

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
      io.to(`hospital_${recipient.id}_admin`).emit('new_report_from_triage', {
        report_id: report.id, 
        title: report.title, 
        priority: report.priority, 
        sender_name: formatFullName(sender)
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToTriageReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);
    if (!parentReport) return res.status(404).json({ success: false, message: "Report not found" });

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) return res.status(404).json({ success: false, message: "Sender not found" });

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let attachments = [];
    
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      attachments = [{
        name: req.file.originalname, 
        url: `${baseUrl}/uploads/reports/${req.file.filename}`,
        type: req.file.mimetype, 
        size: req.file.size, 
        uploaded_at: new Date()
      }];
    }

    const reply = await Report.create({
      report_number, 
      title: `Re: ${parentReport.title}`, 
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
      io.to(`staff_${parentReport.sender_id}`).emit('report_reply_from_triage', {
        report_id: reply.id, 
        title: reply.title, 
        sender_name: formatFullName(sender)
      });
    }

    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Reply to report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markTriageReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'staff' }
    });
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    
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

// ==================== SCHEDULE FUNCTIONS ====================
const getMyScheduleTriage = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const schedules = await Schedule.findAll({
      where: { staff_id: req.user.id, date: { [Op.gte]: new Date() } },
      order: [['date', 'ASC']],
      limit: parseInt(days)
    });

    let totalHours = 0;
    schedules.forEach(schedule => { totalHours += getShiftDisplayName(schedule.shift_type).hours; });

    const processedSchedules = schedules.map(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      return {
        id: schedule.id, 
        date: schedule.date,
        date_formatted: new Date(schedule.date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
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
    
    const todaySchedules = schedules.filter(s => new Date(s.date) >= today && new Date(s.date) < tomorrow);
    const todayHours = todaySchedules.reduce((sum, s) => sum + getShiftDisplayName(s.shift_type).hours, 0);

    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const thisWeekSchedules = schedules.filter(s => new Date(s.date) >= startOfWeek && new Date(s.date) <= endOfWeek);
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
    console.error('Error fetching schedule:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message, 
      schedules: [], 
      total_hours: 0 
    });
  }
};

// ==================== EXPORTS ====================
export { 
  upload,
  getTriageQueue,
  getTriagedPatients,
  getPatientForTriage,
  recordVitalsAndSendToWard,
  getTriageStats,
  getTriageProfile,
  updateTriageProfile,
  changeTriagePassword,
  getTriageReportsInbox,
  getTriageReportsOutbox,
  sendTriageReport,
  replyToTriageReport,
  markTriageReportRead,
  getHospitalAdminsForTriage,
  getMyScheduleTriage
};