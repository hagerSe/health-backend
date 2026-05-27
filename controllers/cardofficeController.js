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
        createdAt: {
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

// ==================== PATIENT REGISTRATION ====================

// @desc    Register new patient and send to triage
// @route   POST /api/card-office/register
// @access  Private
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

    console.log('📝 Registering new patient:', { first_name, last_name, age, gender });

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
      age: parseInt(age),
      gender,
      phone: phone || null,
      hospital_id: parseInt(currentHospitalId),
      status: 'in_triage',
      registered_at: new Date(),
      registered_by: req.user?.full_name || formatFullName(req.user) || 'Card Office Staff',
      registered_by_id: req.user?.id,
      vitals: {},
      triage_info: {
        registered_by: req.user?.full_name || formatFullName(req.user),
        registered_by_id: req.user?.id,
        registered_at: new Date(),
        status: 'waiting_for_triage'
      },
      diagnosis: {},
      prescriptions_history: [],
      prescriptions: [],
      discharge_summary: {}
    });

    const visitNumber = await generateVisitNumber();
    
    await Visit.create({
      patient_id: patient.id,
      hospital_id: parseInt(currentHospitalId),
      visit_number: visitNumber,
      visit_type: 'OPD',
      status: 'active',
      started_at: new Date(),
      chief_complaint: null
    });

    // Send notification to triage staff
    await Notification.create({
      recipient_type: 'staff',
      recipient_id: null,
      department: 'Triage',
      hospital_id: parseInt(currentHospitalId),
      title: 'New Patient Registered',
      message: `Patient ${first_name} ${last_name} (${card_number}) is waiting for triage.`,
      type: 'new_patient',
      priority: 'medium',
      related_id: patient.id,
      related_model: 'Patient',
      is_read: false
    });

    const io = req.app.get('io');
    if (io) {
      const triageRoom = `hospital_${currentHospitalId}_triage`;
      io.to(triageRoom).emit('new_patient_registered', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name}`.trim(),
        age,
        gender,
        phone,
        status: 'in_triage',
        registered_at: new Date(),
        hospital_id: currentHospitalId
      });

      const cardOfficeRoom = `hospital_${currentHospitalId}_card_office`;
      io.to(cardOfficeRoom).emit('patient_registered', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${first_name} ${last_name}`.trim(),
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
    console.error('❌ Patient registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get patients in triage queue (for card office view)
// @route   GET /api/card-office/patients/triage
// @access  Private
export const getPatientsInTriage = async (req, res) => {
  try {
    const { hospital_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'hospital_id is required'
      });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id),
      status: 'in_triage'
    };

    const { count, rows } = await Patient.findAndCountAll({
      where: whereClause,
      order: [['registered_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: ['id', 'card_number', 'first_name', 'middle_name', 'last_name', 
                   'age', 'gender', 'phone', 'status', 'registered_at', 'is_return']
    });

    res.json({
      success: true,
      patients: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('❌ Error getting patients in triage:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Search patients
// @route   GET /api/card-office/patients/search
// @access  Private
export const searchPatients = async (req, res) => {
  try {
    const { query, hospital_id } = req.query;
    
    if (!hospital_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required',
        patients: [],
        count: 0
      });
    }
    
    const whereClause = {
      hospital_id: parseInt(hospital_id)
    };

    if (query && query.trim()) {
      whereClause[Op.or] = [
        { card_number: { [Op.like]: `%${query}%` } },
        { first_name: { [Op.like]: `%${query}%` } },
        { middle_name: { [Op.like]: `%${query}%` } },
        { last_name: { [Op.like]: `%${query}%` } },
        { phone: { [Op.like]: `%${query}%` } }
      ];
    }

    const patients = await Patient.findAll({
      where: whereClause,
      order: [['registered_at', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      patients: patients || [],
      count: patients?.length || 0
    });
  } catch (error) {
    console.error('❌ Patient search error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      patients: [],
      count: 0
    });
  }
};

// @desc    Get patient by ID
// @route   GET /api/card-office/patients/:id
// @access  Private
export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const { hospital_id } = req.query;
    
    if (!hospital_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required' 
      });
    }
    
    const patient = await Patient.findOne({
      where: {
        id: parseInt(id),
        hospital_id: parseInt(hospital_id)
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
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      patient,
      visits
    });
  } catch (error) {
    console.error('❌ Error fetching patient:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Send returning patient to triage
// @route   POST /api/card-office/send-to-triage
// @access  Private
export const sendToTriage = async (req, res) => {
  try {
    const { patientId, reason, hospital_id } = req.body;
    const currentHospitalId = hospital_id;

    console.log(`🔄 Sending returning patient to triage: ${patientId}`);

    if (!currentHospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Hospital ID is required' 
      });
    }

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: parseInt(currentHospitalId)
      }
    });

    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    await patient.update({
      status: 'in_triage',
      return_reason: reason || 'Follow-up visit',
      returned_at: new Date(),
      is_return: true
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
      recipient_type: 'staff',
      recipient_id: null,
      department: 'Triage',
      hospital_id: parseInt(currentHospitalId),
      title: 'Returning Patient',
      message: `Patient ${patient.first_name} ${patient.last_name} has returned. Reason: ${reason || 'Follow-up'}`,
      type: 'return_patient',
      priority: 'medium',
      related_id: patient.id,
      related_model: 'Patient',
      is_read: false
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${currentHospitalId}_triage`).emit('returning_patient', {
        patient_id: patient.id,
        card_number: patient.card_number,
        patient_name: `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`.trim(),
        reason: reason || 'Follow-up visit',
        status: 'in_triage'
      });
    }

    res.json({
      success: true,
      message: 'Patient sent to triage successfully',
      patient
    });
  } catch (error) {
    console.error('❌ Error sending to triage:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get recent patients
// @route   GET /api/card-office/recent
// @access  Private
export const getRecentPatients = async (req, res) => {
  try {
    const { hospital_id, limit = 20 } = req.query;
    
    if (!hospital_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required',
        patients: []
      });
    }
    
    const patients = await Patient.findAll({
      where: { hospital_id: parseInt(hospital_id) },
      order: [['registered_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      patients: patients || []
    });
  } catch (error) {
    console.error('❌ Error fetching recent patients:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      patients: []
    });
  }
};

// @desc    Update patient information
// @route   PUT /api/card-office/patients/:id
// @access  Private
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, middle_name, last_name, phone } = req.body;
    const { hospital_id } = req.query;

    if (!hospital_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required' 
      });
    }

    const patient = await Patient.findOne({
      where: {
        id: parseInt(id),
        hospital_id: parseInt(hospital_id)
      }
    });

    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const activeStatuses = ['with_doctor', 'in_opd', 'in_emergency', 'in_anc', 'admitted'];
    if (activeStatuses.includes(patient.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update patient while status is '${patient.status}'`
      });
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
    console.error('❌ Error updating patient:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== DASHBOARD STATS ====================

// @desc    Get card office statistics
// @route   GET /api/card-office/stats
// @access  Private
export const getCardOfficeStats = async (req, res) => {
  try {
    const { hospital_id } = req.query;
    
    if (!hospital_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required',
        stats: { today: 0, inTriage: 0, active: 0, total: 0 }
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayRegistrations, inTriage, activePatients, totalPatients] = await Promise.all([
      Patient.count({
        where: {
          hospital_id: parseInt(hospital_id),
          registered_at: { [Op.gte]: today }
        }
      }),
      Patient.count({
        where: {
          hospital_id: parseInt(hospital_id),
          status: 'in_triage'
        }
      }),
      Patient.count({
        where: {
          hospital_id: parseInt(hospital_id),
          status: { [Op.in]: ['in_triage', 'in_opd', 'in_emergency', 'in_anc', 'with_doctor'] }
        }
      }),
      Patient.count({
        where: { hospital_id: parseInt(hospital_id) }
      })
    ]);

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
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stats: { today: 0, inTriage: 0, active: 0, total: 0 }
    });
  }
};

// ==================== STAFF PROFILE MANAGEMENT ====================

// @desc    Get card office staff profile
// @route   GET /api/card-office/profile
// @access  Private
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

// @desc    Update card office staff profile
// @route   PUT /api/card-office/profile
// @access  Private
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

// @desc    Change card office staff password
// @route   PUT /api/card-office/change-password
// @access  Private
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

// @desc    Get card office reports inbox
// @route   GET /api/card-office/reports/inbox
// @access  Private
export const getCardOfficeReportsInbox = async (req, res) => {
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
    console.error("Get card office reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get card office reports outbox
// @route   GET /api/card-office/reports/outbox
// @access  Private
export const getCardOfficeReportsOutbox = async (req, res) => {
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
    console.error("Get card office reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send card office report to hospital admin
// @route   POST /api/card-office/reports/send
// @access  Private
export const sendCardOfficeReport = async (req, res) => {
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
      sender_title: `Card Office Staff - ${sender.department || 'Card Office'} Department`,
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
      io.to(adminRoom).emit('new_report_from_card_office', {
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
    console.error("Send card office report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reply to report from card office
// @route   POST /api/card-office/reports/:id/reply
// @access  Private
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
      
      io.to(recipientRoom).emit('report_reply_from_card_office', {
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
    console.error("Card office reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mark card office report as read
// @route   PUT /api/card-office/reports/:id/read
// @access  Private
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
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }

    await report.update({
      is_opened: true,
      opened_at: new Date(),
      opened_count: (report.opened_count || 0) + 1
    });

    res.json({ 
      success: true, 
      message: "Report marked as read" 
    });
  } catch (error) {
    console.error("Mark report read error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get hospital admins for card office
// @route   GET /api/card-office/hospital-admins
// @access  Private
export const getHospitalAdminsForCardOffice = async (req, res) => {
  try {
    const { hospital_id } = req.query;
    
    if (!hospital_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required',
        admins: []
      });
    }
    
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { hospital_id: parseInt(hospital_id) },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name', 'hospital_id']
    });
    
    const formattedAdmins = hospitalAdmins.map(admin => ({
      id: admin.id,
      full_name: formatFullName(admin),
      email: admin.email,
      hospital_name: admin.hospital_name,
      hospital_id: admin.hospital_id
    }));
    
    res.json({ 
      success: true, 
      admins: formattedAdmins 
    });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      admins: []
    });
  }
};

// ==================== STAFF SCHEDULE VIEWING ====================

// @desc    Get my upcoming schedule
// @route   GET /api/card-office/my-schedule
// @access  Private
export const getMyCardOfficeSchedule = async (req, res) => {
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get my weekly schedule
// @route   GET /api/card-office/weekly-schedule
// @access  Private
export const getMyCardOfficeWeeklySchedule = async (req, res) => {
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get my today's schedule
// @route   GET /api/card-office/today-schedule
// @access  Private
export const getMyCardOfficeTodaySchedule = async (req, res) => {
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get my schedule statistics
// @route   GET /api/card-office/schedule-stats
// @access  Private
export const getMyCardOfficeScheduleStats = async (req, res) => {
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
    
    const [thisWeekSchedules, nextWeekSchedules, todaySchedules, upcomingSchedules] = await Promise.all([
      Schedule.findAll({
        where: {
          staff_id: staffId,
          hospital_id: hospitalId,
          date: { [Op.between]: [startOfWeek, endOfWeek] }
        }
      }),
      Schedule.findAll({
        where: {
          staff_id: staffId,
          hospital_id: hospitalId,
          date: { [Op.between]: [nextWeekStart, nextWeekEnd] }
        }
      }),
      Schedule.findAll({
        where: {
          staff_id: staffId,
          hospital_id: hospitalId,
          date: { [Op.between]: [today, new Date(today.getTime() + 24 * 60 * 60 * 1000)] }
        }
      }),
      Schedule.findAll({
        where: {
          staff_id: staffId,
          hospital_id: hospitalId,
          date: { [Op.between]: [new Date(today.getTime() + 24 * 60 * 60 * 1000), new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000)] }
        }
      })
    ]);
    
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get my notifications
// @route   GET /api/card-office/notifications
// @access  Private
// Add this to cardofficeController.js if missing
export const getMyCardOfficeNotifications = async (req, res) => {
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// At the end of cardofficeController.js, make sure all exports are present
export {
  registerPatient,
  getPatientsInTriage,
  searchPatients,
  getPatientById,
  sendToTriage,
  getRecentPatients,
  updatePatient,
  getCardOfficeStats,
  getCardOfficeProfile,
  updateCardOfficeProfile,
  changeCardOfficePassword,
  getCardOfficeReportsInbox,
  getCardOfficeReportsOutbox,
  sendCardOfficeReport,
  replyToCardOfficeReport,
  markCardOfficeReportRead,
  getHospitalAdminsForCardOffice,
  getMyCardOfficeSchedule,
  getMyCardOfficeWeeklySchedule,
  getMyCardOfficeTodaySchedule,
  getMyCardOfficeScheduleStats,
  getMyCardOfficeNotifications
};