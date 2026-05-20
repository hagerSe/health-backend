// backend/controllers/cardofficeController.js
import Patient from '../models/Patient.js';
import Visit from '../models/Visit.js';
import Notification from '../models/Notification.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
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
        created_at: {
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

// ==================== REGISTER NEW PATIENT ====================
export const registerPatient = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      age,
      gender,
      phone
    } = req.body;

    if (!first_name || !last_name || !age || !gender) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const year = new Date().getFullYear();
    
    const lastPatient = await Patient.findOne({
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
      hospital_id: req.user.hospital_id,
      status: 'in_triage',
      registered_at: new Date(),
      registered_by: req.user.full_name,
      registered_by_id: req.user.id
    });

    const visitNumber = await generateVisitNumber();
    
    await Visit.create({
      patient_id: patient.id,
      hospital_id: req.user.hospital_id,
      visit_number: visitNumber,
      visit_type: 'OPD',
      status: 'active',
      started_at: new Date()
    });

    await Notification.create({
      recipient_id: patient.id,
      recipient_type: 'triage_nurse',
      hospital_id: req.user.hospital_id,
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
      const triageRoom = `hospital_${req.user.hospital_id}_triage`;
      console.log(`📢 Emitting to triage room: ${triageRoom}`);
      
      io.to(triageRoom).emit('new_patient_registered', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name}`,
        age,
        gender,
        phone,
        status: 'in_triage',
        registered_at: new Date(),
        hospital_id: req.user.hospital_id
      });

      const cardOfficeRoom = `hospital_${req.user.hospital_id}_cardoffice`;
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
    
    const whereClause = {
      hospital_id: req.user.hospital_id
    };

    if (query) {
      whereClause[Op.or] = [
        { card_number: { [Op.iLike]: `%${query}%` } },
        { first_name: { [Op.iLike]: `%${query}%` } },
        { middle_name: { [Op.iLike]: `%${query}%` } },
        { last_name: { [Op.iLike]: `%${query}%` } },
        { phone: { [Op.iLike]: `%${query}%` } }
      ];
    }

    const patients = await Patient.findAll({
      where: whereClause,
      order: [['registered_at', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      patients,
      count: patients.length
    });

  } catch (error) {
    console.error('Patient search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET PATIENT BY ID ====================
export const getPatientById = async (req, res) => {
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
    const { patientId, reason } = req.body;

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: req.user.hospital_id
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
      hospital_id: req.user.hospital_id,
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
      hospital_id: req.user.hospital_id,
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
      io.to(`hospital_${req.user.hospital_id}_triage`).emit('returning_patient', {
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
    const patients = await Patient.findAll({
      where: { hospital_id: req.user.hospital_id },
      order: [['registered_at', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      patients
    });

  } catch (error) {
    console.error('Error fetching recent patients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET DASHBOARD STATS ====================
export const getCardOfficeStats = async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRegistrations = await Patient.count({
      where: {
        hospital_id: hospitalId,
        registered_at: { [Op.gte]: today }
      }
    });

    const inTriage = await Patient.count({
      where: {
        hospital_id: hospitalId,
        status: 'in_triage'
      }
    });

    const activePatients = await Patient.count({
      where: {
        hospital_id: hospitalId,
        status: { [Op.in]: ['in_triage', 'in_opd', 'in_emergency', 'in_anc', 'with_doctor'] }
      }
    });

    const totalPatients = await Patient.count({
      where: { hospital_id: hospitalId }
    });

    res.json({
      success: true,
      stats: {
        today: todayRegistrations,
        inTriage: inTriage,
        active: activePatients,
        total: totalPatients
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPDATE PATIENT ====================
export const updatePatient = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, phone } = req.body;

    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: req.user.hospital_id
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
        full_name: `${staff.first_name} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name}`.trim()
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

// ==================== REPORT MANAGEMENT ====================
export const getCardOfficeReportsInbox = async (req, res) => {
  try {
    // Using Sequelize ORM instead of raw SQL to avoid enum issues
    const reports = await Report.findAll({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff'
      },
      order: [['sent_at', 'DESC']]
    });
    
    const unreadCount = await Report.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        is_opened: false
      }
    });
    
    // Manually fetch sender info
    const reportsWithSender = await Promise.all(reports.map(async (report) => {
      const sender = await HospitalStaff.findByPk(report.sender_id, {
        attributes: ['first_name', 'last_name', 'email']
      });
      return {
        ...report.toJSON(),
        sender_first_name: sender?.first_name || 'Unknown',
        sender_last_name: sender?.last_name || '',
        sender_email: sender?.email || '',
        sender_full_name: sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Unknown'
      };
    }));
    
    res.json({
      success: true,
      reports: reportsWithSender,
      unreadCount
    });
  } catch (error) {
    console.error("Get card office reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCardOfficeReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: {
        sender_id: req.user.id,
        sender_type: 'staff'
      },
      order: [['sent_at', 'DESC']]
    });
    
    // Manually fetch recipient info
    const reportsWithRecipient = await Promise.all(reports.map(async (report) => {
      let recipientFullName = '';
      let recipientHospitalName = '';
      
      if (report.recipient_type === 'hospital') {
        const admin = await HospitalAdmin.findByPk(report.recipient_id);
        if (admin) {
          recipientFullName = `${admin.first_name} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name}`.trim();
          recipientHospitalName = admin.hospital_name || '';
        }
      } else if (report.recipient_type === 'staff') {
        const staff = await HospitalStaff.findByPk(report.recipient_id);
        if (staff) {
          recipientFullName = `${staff.first_name} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name}`.trim();
        }
      }
      
      // Count attachments
      const attachmentCount = report.attachments?.length || 0;
      
      return {
        ...report.toJSON(),
        recipient_full_name: recipientFullName,
        recipient_hospital_name: recipientHospitalName,
        attachment_count: attachmentCount
      };
    }));
    
    res.json({
      success: true,
      reports: reportsWithRecipient
    });
  } catch (error) {
    console.error("Get card office reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendCardOfficeReport = async (req, res) => {
  try {
    const { title, subject, body, priority, recipient_type, recipient_id } = req.body;

    const sender = await HospitalStaff.findByPk(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    let recipientHospitalName = '';
    
    if (recipient_type === 'hospital') {
      recipient = await HospitalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientHospitalId = recipient.id;
        recipientHospitalName = recipient.hospital_name || '';
      }
    } else if (recipient_type === 'staff') {
      recipient = await HospitalStaff.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientHospitalId = recipient.hospital_id;
        recipientHospitalName = recipient.hospital_name || '';
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

    // Handle attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/reports/${file.filename}`,
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
      attachments: attachments,
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Card Office Staff - ${sender.department || 'Card Office'} Department`,
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      recipient_id: recipient.id,
      recipient_type: recipient_type,
      recipient_first_name: recipient.first_name || '',
      recipient_middle_name: recipient.middle_name || '',
      recipient_last_name: recipient.last_name || '',
      recipient_full_name: recipientFullName,
      recipient_hospital: recipientHospitalName,
      recipient_hospital_id: recipientHospitalId,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (recipient_type === 'hospital') {
        recipientRoom = `hospital_${recipientHospitalId}_admin`;
      } else if (recipient_type === 'staff') {
        recipientRoom = `hospital_${recipientHospitalId}_staff_${recipient.id}`;
      }
      
      io.to(recipientRoom).emit('new_report_from_cardoffice', {
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
    if (req.file) {
      attachments = [{
        name: req.file.originalname,
        url: `/uploads/reports/${req.file.filename}`,
        type: req.file.mimetype,
        size: req.file.size,
        uploaded_at: new Date()
      }];
    }

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject,
      body,
      priority: parentReport.priority,
      status: 'sent',
      attachments: attachments,
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Card Office Staff - ${sender.department || 'Card Office'} Department`,
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
      
      console.log(`📡 Emitting 'report_reply_from_cardoffice' to room: ${recipientRoom}`);
      
      io.to(recipientRoom).emit('report_reply_from_cardoffice', {
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
    console.error("Card office reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const markCardOfficeReportRead = async (req, res) => {
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

// backend/controllers/cardofficeController.js
// Replace ONLY this function at the bottom of your file:

export const getHospitalAdminsForCardOffice = async (req, res) => {
  try {
    console.log('🏥 Fetching hospital admins for hospital:', req.user.hospital_id);
    
    // Try different possible column names
    let hospitalAdmins;
    
    // First try with 'hospital_id'
    try {
      hospitalAdmins = await HospitalAdmin.findAll({
        where: { hospital_id: req.user.hospital_id },
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
      });
    } catch (error) {
      // If 'hospital_id' fails, try 'id' (some models use id as hospital reference)
      console.log('Trying alternative query...');
      hospitalAdmins = await HospitalAdmin.findAll({
        where: { id: req.user.hospital_id },
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
      });
    }
    
    console.log('📋 Found hospital admins:', hospitalAdmins?.length || 0);
    
    const formattedAdmins = (hospitalAdmins || []).map(admin => ({
      id: admin.id,
      full_name: `${admin.first_name || ''} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name || ''}`.trim(),
      email: admin.email || '',
      hospital_name: admin.hospital_name || 'Hospital',
      hospital_id: admin.id
    }));
    
    res.json({ 
      success: true, 
      admins: formattedAdmins 
    });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    // Return empty array instead of error to prevent frontend crash
    res.json({ 
      success: true, 
      admins: [],
      message: 'No hospital admins found'
    });
  }
};