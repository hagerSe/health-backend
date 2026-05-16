// backend/controllers/triageController.js
import Patient from '../models/Patient.js';
import Visit from '../models/Visit.js';
import Notification from '../models/Notification.js';
import VitalSign from '../models/VitalSign.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
// Add this import at the top of triageController.js
import KebeleAdmin from '../models/KebeleAdmin.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';

// ==================== HELPER FUNCTION TO GENERATE VISIT NUMBER ====================
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
        visit_date: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });
    
    const sequence = String(todayCount + 1).padStart(4, '0');
    const visitNumber = `VIS-${dateStr}-${sequence}`;
    console.log('✅ Generated visit number:', visitNumber);
    return visitNumber;
  } catch (error) {
    console.error('❌ Error generating visit number:', error);
    return `VIS-${Date.now()}`;
  }
};

// ==================== HELPER FUNCTION TO DETERMINE PRIORITY ====================
const determinePriority = (ward, vitals) => {
  let priority = 'routine';
  
  if (ward === 'EME') {
    priority = 'urgent';
  }
  
  if (vitals.blood_pressure) {
    const systolic = parseInt(vitals.blood_pressure.split('/')[0]);
    if (systolic > 180) priority = 'critical';
    else if (systolic > 140) priority = 'high';
  }
  
  if (vitals.oxygen_saturation) {
    const o2 = parseInt(vitals.oxygen_saturation);
    if (o2 < 90) priority = 'critical';
    else if (o2 < 94) priority = 'high';
  }
  
  if (vitals.temperature) {
    const temp = parseFloat(vitals.temperature);
    if (temp > 39 || temp < 35) priority = 'critical';
    else if (temp > 38 || temp < 36) priority = 'high';
  }
  
  if (vitals.heart_rate) {
    const hr = parseInt(vitals.heart_rate);
    if (hr > 120 || hr < 50) priority = 'critical';
    else if (hr > 100 || hr < 60) priority = 'high';
  }
  
  return priority;
};

// ==================== HELPER FUNCTION TO CALCULATE BMI ====================
const calculateBMI = (weight, height) => {
  if (weight && height && height > 0) {
    const heightInM = height / 100;
    return (weight / (heightInM * heightInM)).toFixed(1);
  }
  return null;
};

// ==================== GET PATIENTS WAITING FOR TRIAGE ====================
export const getTriageQueue = async (req, res) => {
  try {
    const patients = await Patient.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        status: 'in_triage'
      },
      order: [['registered_at', 'ASC']]
    });

    res.json({
      success: true,
      patients
    });
  } catch (error) {
    console.error('Error getting triage queue:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET TRIAGED PATIENTS ====================
export const getTriagedPatients = async (req, res) => {
  try {
    const patients = await Patient.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        status: { [Op.in]: ['in_opd', 'in_emergency', 'in_anc'] }
      },
      order: [['triaged_at', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      patients
    });
  } catch (error) {
    console.error('Error getting triaged patients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET PATIENT BY ID FOR TRIAGE ====================
export const getPatientForTriage = async (req, res) => {
  try {
    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: req.user.hospital_id
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({
      success: true,
      patient
    });
  } catch (error) {
    console.error('Error getting patient:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== RECORD VITALS AND SEND TO WARD ====================
export const recordVitalsAndSendToWard = async (req, res) => {
  try {
    const { patientId, vitals, ward, notes } = req.body;

    console.log('📤 Recording vitals and sending to ward:', { patientId, ward });

    if (!patientId || !ward) {
      return res.status(400).json({ 
        success: false, 
        message: 'Patient ID and ward are required' 
      });
    }

    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const statusMap = {
      'OPD': 'in_opd',
      'EME': 'in_emergency',
      'ANC': 'in_anc'
    };

    const priority = determinePriority(ward, vitals);
    const bmi = calculateBMI(vitals.weight, vitals.height);

    await patient.update({
      vitals: {
        ...vitals,
        bmi,
        recorded_at: new Date(),
        recorded_by: req.user.full_name,
        recorded_by_id: req.user.id
      },
      triage_info: {
        triaged_by: req.user.full_name,
        triaged_by_id: req.user.id,
        triaged_at: new Date(),
        destination: ward,
        ward: ward,
        priority: priority,
        notes: notes || vitals.chief_complaint || vitals.notes
      },
      status: statusMap[ward],
      ward: ward,
      triaged_at: new Date()
    });

    const visitNumber = await generateVisitNumber();

    let visit = await Visit.findOne({
      where: { patient_id: patient.id, status: 'active' }
    });

    if (visit) {
      await visit.update({
        status: 'active',
        ward: ward,
        chief_complaint: vitals.chief_complaint || vitals.notes,
        triage_vitals: { ...vitals, bmi, priority },
        triage_nurse: req.user.full_name,
        triage_nurse_id: req.user.id,
        triaged_at: new Date()
      });
    } else {
      const visitType = ward === 'OPD' ? 'OPD' : ward === 'EME' ? 'Emergency' : 'ANC';
      await Visit.create({
        patient_id: patient.id,
        hospital_id: req.user.hospital_id,
        visit_number: visitNumber,
        ward: ward,
        visit_type: visitType,
        status: 'active',
        chief_complaint: vitals.chief_complaint || vitals.notes,
        triage_vitals: { ...vitals, bmi, priority },
        triage_nurse: req.user.full_name,
        triage_nurse_id: req.user.id,
        triaged_at: new Date(),
        started_at: new Date()
      });
    }

    try {
      await VitalSign.create({
        patient_id: patient.id,
        recorded_by_id: req.user.id,
        recorded_by_name: req.user.full_name || 'Triage Nurse',
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
        notes: notes || vitals.chief_complaint || vitals.notes || null
      });
      console.log('✅ Vital signs saved successfully');
    } catch (vitalError) {
      console.error('Error saving vital signs:', vitalError);
    }

    const io = req.app.get('io');
    if (io) {
      try {
        const wardRoom = `hospital_${req.user.hospital_id}_ward_${ward}`;
        io.to(wardRoom).emit('new_patient_in_ward', {
          patient_id: patient.id,
          card_number: patient.card_number,
          patient_name: `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`,
          age: patient.age,
          gender: patient.gender,
          vitals: { ...vitals, bmi, priority },
          priority: priority,
          ward: ward,
          hospital_id: req.user.hospital_id,
          triage_nurse: req.user.full_name,
          message: `New patient assigned to ${ward} Ward`,
          timestamp: new Date()
        });

        io.to(`hospital_${req.user.hospital_id}_triage`).emit('patient_removed_from_triage', {
          patient_id: patient.id
        });
      } catch (socketError) {
        console.error('Error emitting socket events:', socketError);
      }
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
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error processing patient'
    });
  }
};

// ==================== GET TRIAGE DASHBOARD STATS ====================
export const getTriageStats = async (req, res) => {
  try {
    const waiting = await Patient.count({
      where: {
        hospital_id: req.user.hospital_id,
        status: 'in_triage'
      }
    });

    const opd = await Patient.count({
      where: {
        hospital_id: req.user.hospital_id,
        ward: 'OPD',
        status: 'in_opd'
      }
    });

    const eme = await Patient.count({
      where: {
        hospital_id: req.user.hospital_id,
        ward: 'EME',
        status: 'in_emergency'
      }
    });

    const anc = await Patient.count({
      where: {
        hospital_id: req.user.hospital_id,
        ward: 'ANC',
        status: 'in_anc'
      }
    });

    res.json({
      success: true,
      stats: { waiting, opd, eme, anc }
    });

  } catch (error) {
    console.error('Error getting triage stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TRIAGE STAFF PROFILE ====================
export const getTriageProfile = async (req, res) => {
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
        full_name: `${staff.first_name} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name}`.trim()
      }
    });
  } catch (error) {
    console.error("Get triage profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateTriageProfile = async (req, res) => {
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
    console.error("Update triage profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const changeTriagePassword = async (req, res) => {
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

// ==================== TRIAGE REPORT MANAGEMENT ====================
export const getTriageReportsInbox = async (req, res) => {
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
    console.error("Get triage reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTriageReportsOutbox = async (req, res) => {
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
    console.error("Get triage reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendTriageReport = async (req, res) => {
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
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
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

    const report = await Report.create({
      report_number,
      title,
      subject: subject || title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Triage Nurse - ${sender.department || 'Triage'} Department`,
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
      io.to(adminRoom).emit('new_report_from_triage', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_department: sender.department,
        sent_at: report.sent_at
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send triage report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// backend/controllers/triageController.js - Fixed replyToTriageReport

export const replyToTriageReport = async (req, res) => {
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

    // Determine recipient information
    const recipientId = parentReport.sender_id === req.user.id ? parentReport.recipient_id : parentReport.sender_id;
    const recipientType = parentReport.sender_id === req.user.id ? parentReport.recipient_type : parentReport.sender_type;

    // Get complete recipient information
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
        recipientFullName = `${recipientFirstName} ${recipientMiddleName ? recipientMiddleName + ' ' : ''}${recipientLastName}`.trim();
        recipientHospitalId = hospitalAdmin.id;
        recipientHospitalName = hospitalAdmin.hospital_name || '';
      }
    } else if (recipientType === 'staff') {
      const staffMember = await HospitalStaff.findByPk(recipientId);
      if (staffMember) {
        recipientFirstName = staffMember.first_name || '';
        recipientMiddleName = staffMember.middle_name || '';
        recipientLastName = staffMember.last_name || '';
        recipientFullName = `${recipientFirstName} ${recipientMiddleName ? recipientMiddleName + ' ' : ''}${recipientLastName}`.trim();
        recipientHospitalId = staffMember.hospital_id;
        recipientHospitalName = staffMember.hospital_name || '';
      }
    }

    console.log(`📡 Reply recipient - Type: ${recipientType}, ID: ${recipientId}, Name: ${recipientFullName}`);

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

    // Process attachment if any
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
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Triage Nurse - ${sender.department || 'Triage'} Department`,
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
      
      console.log(`📡 Emitting 'report_reply_from_triage' to room: ${recipientRoom}`);
      
      io.to(recipientRoom).emit('report_reply_from_triage', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
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
    console.error("Triage reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}; // ✅ Make sure this closing brace is present

export const markTriageReportRead = async (req, res) => {
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

export const getHospitalAdminsForTriage = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};