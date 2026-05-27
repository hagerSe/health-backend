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

    const currentHospitalId = hospital_id || req.user.hospital_id;

    const year = new Date().getFullYear();
    
    const lastPatient = await Patient.findOne({
      where: { hospital_id: currentHospitalId },
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
      hospital_id: currentHospitalId,
      status: 'in_triage',
      registered_at: new Date(),
      registered_by: req.user.full_name,
      registered_by_id: req.user.id
    });

    const visitNumber = await generateVisitNumber();
    
    await Visit.create({
      patient_id: patient.id,
      hospital_id: currentHospitalId,
      visit_number: visitNumber,
      visit_type: 'OPD',
      status: 'active',
      started_at: new Date()
    });

    await Notification.create({
      recipient_id: patient.id,
      recipient_type: 'triage_nurse',
      hospital_id: currentHospitalId,
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    const whereClause = {
      hospital_id: hospitalId
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: hospitalId
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
    const currentHospitalId = hospital_id || req.user.hospital_id;

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: currentHospitalId
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
      hospital_id: currentHospitalId,
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
      hospital_id: currentHospitalId,
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    const patients = await Patient.findAll({
      where: { hospital_id: hospitalId },
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;

    const patient = await Patient.findOne({
      where: {
        id: req.params.id,
        hospital_id: hospitalId
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    const staff = await HospitalStaff.findOne({
      where: {
        id: req.user.id,
        hospital_id: hospitalId
      },
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
    const { first_name, middle_name, last_name, gender, age, phone, hospital_id } = req.body;
    const currentHospitalId = hospital_id || req.user.hospital_id;
    
    const staff = await HospitalStaff.findOne({
      where: {
        id: req.user.id,
        hospital_id: currentHospitalId
      }
    });
    
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
    
    const updatedStaff = await HospitalStaff.findOne({
      where: {
        id: req.user.id,
        hospital_id: currentHospitalId
      },
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
    const { current_password, new_password, hospital_id } = req.body;
    const currentHospitalId = hospital_id || req.user.hospital_id;
    
    const staff = await HospitalStaff.findOne({
      where: {
        id: req.user.id,
        hospital_id: currentHospitalId
      }
    });
    
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    // Get reports where this staff member is the recipient AND same hospital
    const reports = await Report.findAll({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        recipient_hospital_id: hospitalId
      },
      order: [['sent_at', 'DESC']]
    });
    
    const unreadCount = await Report.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        recipient_hospital_id: hospitalId,
        is_opened: false
      }
    });
    
    // Fetch sender info for each report
    const reportsWithSender = await Promise.all(reports.map(async (report) => {
      let senderFullName = 'Unknown';
      let senderFirstName = '';
      let senderLastName = '';
      
      if (report.sender_type === 'hospital') {
        const admin = await HospitalAdmin.findByPk(report.sender_id);
        if (admin) {
          senderFirstName = admin.first_name || '';
          senderLastName = admin.last_name || '';
          senderFullName = `${senderFirstName} ${senderLastName}`.trim();
        }
      } else if (report.sender_type === 'staff') {
        const staff = await HospitalStaff.findOne({
          where: {
            id: report.sender_id,
            hospital_id: hospitalId
          }
        });
        if (staff) {
          senderFirstName = staff.first_name || '';
          senderLastName = staff.last_name || '';
          senderFullName = `${senderFirstName} ${senderLastName}`.trim();
        }
      }
      
      return {
        ...report.toJSON(),
        sender_first_name: senderFirstName,
        sender_last_name: senderLastName,
        sender_full_name: senderFullName
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
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    const reports = await Report.findAll({
      where: {
        sender_id: req.user.id,
        sender_type: 'staff',
        sender_hospital_id: hospitalId
      },
      order: [['sent_at', 'DESC']]
    });
    
    // Fetch recipient info for each report
    const reportsWithRecipient = await Promise.all(reports.map(async (report) => {
      let recipientFullName = '';
      let recipientHospitalName = '';
      
      if (report.recipient_type === 'hospital') {
        const admin = await HospitalAdmin.findOne({
          where: {
            id: report.recipient_id,
            hospital_id: hospitalId
          }
        });
        if (admin) {
          recipientFullName = `${admin.first_name || ''} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name || ''}`.trim();
          recipientHospitalName = admin.hospital_name || '';
        }
      } else if (report.recipient_type === 'staff') {
        const staff = await HospitalStaff.findOne({
          where: {
            id: report.recipient_id,
            hospital_id: hospitalId
          }
        });
        if (staff) {
          recipientFullName = `${staff.first_name || ''} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name || ''}`.trim();
        }
      }
      
      const attachmentCount = report.attachments?.length || 0;
      
      return {
        ...report.toJSON(),
        recipient_full_name: recipientFullName || 'Unknown',
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
    const { title, subject, body, priority, recipient_type, recipient_id, hospital_id } = req.body;
    const currentHospitalId = hospital_id || req.user.hospital_id;

    const sender = await HospitalStaff.findOne({
      where: {
        id: req.user.id,
        hospital_id: currentHospitalId
      }
    });
    
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    let recipientHospitalName = '';
    
    if (recipient_type === 'hospital') {
      recipient = await HospitalAdmin.findOne({
        where: {
          id: recipient_id,
          hospital_id: currentHospitalId
        }
      });
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name || ''}`.trim();
        recipientHospitalId = recipient.id;
        recipientHospitalName = recipient.hospital_name || '';
      }
    } else if (recipient_type === 'staff') {
      recipient = await HospitalStaff.findOne({
        where: {
          id: recipient_id,
          hospital_id: currentHospitalId
        }
      });
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name || ''}`.trim();
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
      sender_hospital_id: currentHospitalId,
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
        recipientRoom = `hospital_${currentHospitalId}_admin`;
      } else if (recipient_type === 'staff') {
        recipientRoom = `hospital_${currentHospitalId}_staff_${recipient.id}`;
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
    const { body, hospital_id } = req.body;
    const currentHospitalId = hospital_id || req.user.hospital_id;
    
    const parentReport = await Report.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { sender_hospital_id: currentHospitalId },
          { recipient_hospital_id: currentHospitalId }
        ]
      }
    });

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

    const sender = await HospitalStaff.findOne({
      where: {
        id: req.user.id,
        hospital_id: currentHospitalId
      }
    });
    
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
      const hospitalAdmin = await HospitalAdmin.findOne({
        where: {
          id: recipientId,
          hospital_id: currentHospitalId
        }
      });
      if (hospitalAdmin) {
        recipientFirstName = hospitalAdmin.first_name || '';
        recipientMiddleName = hospitalAdmin.middle_name || '';
        recipientLastName = hospitalAdmin.last_name || '';
        recipientFullName = `${recipientFirstName} ${recipientMiddleName ? recipientMiddleName + ' ' : ''}${recipientLastName}`.trim();
        recipientHospitalId = hospitalAdmin.id;
        recipientHospitalName = hospitalAdmin.hospital_name || '';
      }
    } else if (recipientType === 'staff') {
      const staffMember = await HospitalStaff.findOne({
        where: {
          id: recipientId,
          hospital_id: currentHospitalId
        }
      });
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
      sender_hospital_id: currentHospitalId,
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
        recipientRoom = `hospital_${currentHospitalId}_admin`;
      } else if (recipientType === 'staff') {
        recipientRoom = `hospital_${currentHospitalId}_staff_${recipientId}`;
      }
      
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
    const { hospital_id } = req.body;
    const currentHospitalId = hospital_id || req.user.hospital_id;
    
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        recipient_id: req.user.id,
        recipient_type: 'staff',
        recipient_hospital_id: currentHospitalId
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

// ==================== GET HOSPITAL ADMINS FOR CARD OFFICE ====================
export const getHospitalAdminsForCardOffice = async (req, res) => {
  try {
    const hospitalId = req.query.hospital_id || req.user.hospital_id;
    
    // Get hospital admins from the same hospital only
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { hospital_id: hospitalId },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
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
    res.json({ 
      success: true, 
      admins: [],
      message: 'No hospital admins found'
    });
  }
};

// ==================== SCHEDULE FUNCTIONS FOR CARD OFFICE ====================
const getShiftDisplayNameCardOffice = (shiftType) => {
  const shifts = {
    morning: { name: 'Morning', start: '08:00', end: '14:00', hours: 6 },
    afternoon: { name: 'Afternoon', start: '14:00', end: '20:00', hours: 6 },
    night: { name: 'Night', start: '20:00', end: '08:00', hours: 12 }
  };
  return shifts[shiftType] || { name: shiftType, start: '--:--', end: '--:--', hours: 0 };
};

export const getMyScheduleCardOffice = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const staffId = req.user.id;
    const hospitalId = req.query.hospital_id || req.user.hospital_id;

    const Schedule = (await import('../models/Schedule.js')).default;

    const whereClause = {
      staff_id: staffId,
      hospital_id: hospitalId
    };

    if (start_date && end_date) {
      whereClause.date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(today.getDate() + 30);
      whereClause.date = {
        [Op.between]: [today, thirtyDaysLater]
      };
    }

    const schedules = await Schedule.findAll({
      where: whereClause,
      order: [['date', 'ASC']]
    });

    const processedSchedules = schedules.map(schedule => {
      const shift = getShiftDisplayNameCardOffice(schedule.shift_type);
      return {
        id: schedule.id,
        date: schedule.date,
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_start: shift.start,
        shift_end: shift.end,
        shift_hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status
      };
    });

    const totalHours = processedSchedules.reduce((sum, s) => sum + s.shift_hours, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeekDate = new Date(today);
    nextWeekDate.setDate(today.getDate() + 7);
    
    const upcomingShifts = processedSchedules.filter(s => {
      const scheduleDate = new Date(s.date);
      return scheduleDate >= today && scheduleDate <= nextWeekDate;
    });

    const todayStr = today.toISOString().split('T')[0];
    const todaySchedules = processedSchedules.filter(s => s.date === todayStr);
    const todayHours = todaySchedules.reduce((sum, s) => sum + s.shift_hours, 0);

    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(today.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const thisWeekSchedules = processedSchedules.filter(s => {
      const sDate = new Date(s.date);
      return sDate >= startOfWeek && sDate <= endOfWeek;
    });
    const thisWeekHours = thisWeekSchedules.reduce((sum, s) => sum + s.shift_hours, 0);

    res.json({
      success: true,
      schedules: processedSchedules,
      total_hours: totalHours,
      upcoming_shifts: upcomingShifts,
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