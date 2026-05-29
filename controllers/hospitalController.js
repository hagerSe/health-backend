import HospitalAdmin from "../models/HospitalAdmin.js";
import HospitalStaff from "../models/HospitalStaff.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import Patient from "../models/Patient.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";
import { saveAttachments } from '../utils/attachmentHelper.js';
import { Op } from "sequelize";

// ==================== PROFILE MANAGEMENT ====================

export const getProfile = async (req, res) => {
  try {
    const hospital = await HospitalAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: KebeleAdmin,
        as: 'kebele_admin',
        attributes: ['id', 'first_name', 'last_name', 'email', 'kebele_name']
      }]
    });
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital admin not found" });
    }
    
    res.json({ success: true, hospital });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHospitalProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone, hospital_name, service_type, hospital_type, address, website } = req.body;
    
    const hospital = await HospitalAdmin.findByPk(req.user.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital admin not found" });
    }
    
    await hospital.update({
      first_name: first_name || hospital.first_name,
      middle_name: middle_name !== undefined ? middle_name : hospital.middle_name,
      last_name: last_name || hospital.last_name,
      gender: gender || hospital.gender,
      age: age || hospital.age,
      phone: phone !== undefined ? phone : hospital.phone,
      hospital_name: hospital_name || hospital.hospital_name,
      service_type: service_type || hospital.service_type,
      hospital_type: hospital_type || hospital.hospital_type,
      address: address !== undefined ? address : hospital.address,
      website: website !== undefined ? website : hospital.website
    });
    
    const updatedHospital = await HospitalAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: KebeleAdmin, as: 'kebele_admin', attributes: ['kebele_name'] }]
    });
    
    res.json({ success: true, hospital: updatedHospital, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update hospital profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeHospitalPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const hospital = await HospitalAdmin.findByPk(req.user.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital admin not found" });
    }
    
    const isMatch = await bcrypt.compare(current_password, hospital.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await hospital.update({ password: hashedPassword });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalKebeleAdmin = async (req, res) => {
  try {
    const hospital = await HospitalAdmin.findByPk(req.user.id, {
      include: [{
        model: KebeleAdmin,
        as: 'kebele_admin',
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'kebele_name']
      }]
    });
    
    if (!hospital || !hospital.kebele_admin) {
      return res.json({ success: false, message: "No kebele admin found for this hospital" });
    }
    
    res.json({
      success: true,
      kebele_admin: {
        id: hospital.kebele_admin.id,
        full_name: `${hospital.kebele_admin.first_name} ${hospital.kebele_admin.middle_name ? hospital.kebele_admin.middle_name + ' ' : ''}${hospital.kebele_admin.last_name}`.trim(),
        email: hospital.kebele_admin.email,
        kebele_name: hospital.kebele_admin.kebele_name
      }
    });
  } catch (error) {
    console.error("Get kebele admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== HOSPITAL STAFF MANAGEMENT ====================

const REQUIRE_WARD_DEPARTMENTS = ['Doctor', 'Nurse', 'Midwife', 'Pharma', 'Lab', 'Radio'];
const VALID_WARDS = ['OPD', 'EME', 'ANC'];

export const createStaff = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, email, password, phone, department, ward } = req.body;
    
    if (!first_name || !last_name || !email || !password || !department) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    if (REQUIRE_WARD_DEPARTMENTS.includes(department)) {
      if (!ward) {
        return res.status(400).json({
          success: false,
          message: `${department} must be assigned to a ward. Required wards: OPD, EME, or ANC`
        });
      }
      if (!VALID_WARDS.includes(ward)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ward. Must be one of: ${VALID_WARDS.join(', ')}`
        });
      }
    }
    
    const existingStaff = await HospitalStaff.findOne({ where: { email } });
    if (existingStaff) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    
    const hospital = await HospitalAdmin.findByPk(req.user.id);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const staff = await HospitalStaff.create({
      hospital_id: req.user.id,
      first_name, middle_name, last_name, gender, age, email,
      password: hashedPassword, phone, department,
      ward: REQUIRE_WARD_DEPARTMENTS.includes(department) ? ward : null,
      role: department, status: "active"
    });
    
    try {
      await Notification.create({
        title: "New Staff Member Added",
        message: `${department} ${first_name} ${last_name} has been added to staff`,
        type: "success", priority: "medium",
        sender_id: req.user.id, sender_type: "hospital",
        sender_name: `${hospital.first_name} ${hospital.last_name}`,
        recipient_id: req.user.id, recipient_type: "hospital",
        recipient_name: `${hospital.first_name} ${hospital.last_name}`,
        related_user_id: staff.id, related_user_type: "staff",
        action_url: "/staff", action_text: "View Staff"
      });
    } catch (notifError) {
      console.warn("⚠️ Notification creation failed:", notifError.message);
    }
    
    const created = await HospitalStaff.findByPk(staff.id, { attributes: { exclude: ['password'] } });
    res.status(201).json({ success: true, staff: created, message: `${department} staff member created successfully` });
  } catch (error) {
    console.error("Create staff error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStaff = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', department, ward } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { hospital_id: req.user.id };
    if (department && department !== 'all') whereClause.department = department;
    if (ward && ward !== 'all') whereClause.ward = ward;
    
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { department: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const totalCount = await HospitalStaff.count({ where: whereClause });
    const staff = await HospitalStaff.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    
    const formattedStaff = staff.map(member => ({
      id: member.id,
      full_name: `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`.trim(),
      first_name: member.first_name, middle_name: member.middle_name, last_name: member.last_name,
      email: member.email, phone: member.phone, gender: member.gender, age: member.age,
      department: member.department, ward: member.ward, status: member.status || 'active',
      created_at: member.createdAt
    }));
    
    res.json({ success: true, staff: formattedStaff, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page), totalCount });
  } catch (error) {
    console.error("Get staff error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllHospitalStaff = async (req, res) => {
  try {
    const staff = await HospitalStaff.findAll({
      where: { hospital_id: req.user.id, status: 'active' },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'department', 'ward', 'email']
    });
    
    const formattedStaff = staff.map(member => ({
      id: member.id,
      full_name: `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`.trim(),
      department: member.department, ward: member.ward, email: member.email
    }));
    
    res.json({ success: true, staff: formattedStaff });
  } catch (error) {
    console.error("Get all staff error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, middle_name, last_name, gender, age, phone, department, ward, status } = req.body;
    
    const staff = await HospitalStaff.findOne({ where: { id, hospital_id: req.user.id } });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }
    
    if (department && REQUIRE_WARD_DEPARTMENTS.includes(department)) {
      if (!ward) {
        return res.status(400).json({
          success: false,
          message: `${department} must be assigned to a ward. Required wards: OPD, EME, or ANC`
        });
      }
    }
    
    await staff.update({
      first_name: first_name || staff.first_name,
      middle_name: middle_name !== undefined ? middle_name : staff.middle_name,
      last_name: last_name || staff.last_name,
      gender: gender || staff.gender, age: age || staff.age,
      phone: phone !== undefined ? phone : staff.phone,
      department: department || staff.department,
      ward: ward !== undefined ? ward : staff.ward,
      status: status || staff.status, role: department || staff.department
    });
    
    const updated = await HospitalStaff.findByPk(id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, staff: updated, message: "Staff member updated successfully" });
  } catch (error) {
    console.error("Update staff error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await HospitalStaff.findOne({ where: { id, hospital_id: req.user.id } });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }
    await staff.update({ status: 'inactive' });
    res.json({ success: true, message: "Staff member deactivated successfully" });
  } catch (error) {
    console.error("Delete staff error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT WITH CHAT-LIKE REPLIES ====================

// controllers/hospitalController.js - Add at top


// ==================== FIXED SEND REPORT ====================
export const sendReport = async (req, res) => {
  try {
    const { title, subject, body, priority, recipient_type, recipient_id } = req.body;
    
    const sender = await HospitalAdmin.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    
    if (recipient_type === 'kebele') {
      const hospital = await HospitalAdmin.findByPk(req.user.id, {
        include: [{ model: KebeleAdmin, as: 'kebele_admin' }]
      });
      recipient = hospital.kebele_admin;
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      }
    } else if (recipient_type === 'staff') {
      recipient = await HospitalStaff.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientHospitalId = recipient.hospital_id;
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
    
    // ✅ FIXED: Save attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = await saveAttachments(req.files, 'hospital');
      console.log(`✅ ${attachments.length} attachment(s) saved for hospital report`);
    }
    
    const report = await Report.create({
      report_number, title, subject: subject || title, body, priority: priority || 'medium', status: 'sent',
      attachments: attachments, // ✅ Save to database
      sender_id: sender.id, sender_type: 'hospital',
      sender_first_name: sender.first_name, sender_middle_name: sender.middle_name, sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Hospital Admin - ${sender.hospital_name || sender.first_name}`,
      sender_hospital: sender.hospital_name, sender_hospital_id: sender.id,
      recipient_id: recipient.id, recipient_type: recipient_type === 'kebele' ? 'kebele' : 'staff',
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipient_type === 'staff' ? sender.hospital_name : '',
      recipient_hospital_id: recipientHospitalId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    
    const io = req.app.get('io');
    if (io && recipient_type === 'staff') {
      const recipientRoom = `hospital_${recipientHospitalId}_staff_${recipient.id}`;
      io.to(recipientRoom).emit('new_report_from_hospital', {
        report_id: report.id, report_number: report.report_number, title: report.title,
        priority: report.priority, sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
        sent_at: report.sent_at, body_preview: body.substring(0, 100), body: body,
        has_attachments: attachments.length > 0,
        attachments_count: attachments.length
      });
    }
    
    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FIXED REPLY TO REPORT ====================
export const replyToReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const admin = req.user;
    
    if (!body && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: 'Reply message or attachment is required' });
    }
    
    const parentReport = await Report.findByPk(id);
    if (!parentReport) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientDepartment = '';
    let recipientWard = '';
    
    if (parentReport.sender_type === 'staff') {
      recipient = await HospitalStaff.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientDepartment = recipient.department || '';
        recipientWard = recipient.ward || '';
      }
    } else if (parentReport.sender_type === 'kebele') {
      recipient = await KebeleAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
      }
    }
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    
    const report_number = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const threadId = parentReport.thread_id || parentReport.id;
    
    // ✅ FIXED: Save reply attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = await saveAttachments(req.files, 'hospital');
      console.log(`✅ ${attachments.length} attachment(s) saved for reply`);
    }
    
    const reply = await Report.create({
      report_number, title: `Re: ${parentReport.title}`, subject: parentReport.subject, body: body || '',
      priority: parentReport.priority, status: 'sent',
      attachments: attachments, // ✅ Save to database
      sender_id: admin.id, sender_type: 'hospital',
      sender_first_name: admin.first_name, sender_middle_name: admin.middle_name, sender_last_name: admin.last_name,
      sender_full_name: `${admin.first_name || ''} ${admin.middle_name || ''} ${admin.last_name || ''}`.trim(),
      sender_title: `Hospital Admin - ${admin.hospital_name}`, sender_hospital: admin.hospital_name, sender_hospital_id: admin.id,
      recipient_id: recipient.id, recipient_type: parentReport.sender_type,
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName, recipient_hospital: recipient.hospital_name, recipient_hospital_id: recipient.hospital_id,
      recipient_department: recipientDepartment, recipient_ward: recipientWard,
      parent_report_id: parentReport.id, thread_id: threadId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    
    await parentReport.update({ status: 'replied', last_activity_at: new Date(), reply_count: (parentReport.reply_count || 0) + 1 });
    
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'staff') {
        recipientRoom = `hospital_${recipient.hospital_id}_staff_${recipient.id}`;
      } else if (parentReport.sender_type === 'kebele') {
        recipientRoom = `kebele_${recipient.id}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_hospital', {
          report_id: reply.id, parent_report_id: parentReport.id, report_number: reply.report_number,
          title: reply.title, priority: reply.priority, sender_name: `${admin.first_name} ${admin.last_name}`,
          sender_department: 'Hospital Admin', sent_at: reply.sent_at, body_preview: (body || '').substring(0, 100),
          is_reply: true, has_attachments: attachments.length > 0,
          attachments_count: attachments.length
        });
      }
    }
    
    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error('Reply to report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'hospital' };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
        { sender_full_name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({
      where: whereClause, order: [['sent_at', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    
    const formattedReports = reports.map(report => ({ ...report.toJSON(), is_reply: !!report.parent_report_id }));
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'hospital', is_opened: false } });
    
    res.json({ success: true, reports: formattedReports, totalCount, unreadCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get conversation thread (chat-like view)
export const getConversationThread = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const parentReport = await Report.findOne({
      where: {
        id: reportId,
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'hospital' },
          { recipient_id: req.user.id, recipient_type: 'hospital' }
        ]
      }
    });
    
    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    
    const threadId = parentReport.thread_id || parentReport.id;
    
    const allMessages = await Report.findAll({
      where: {
        [Op.or]: [
          { id: threadId },
          { thread_id: threadId },
          { parent_report_id: threadId }
        ]
      },
      order: [['sent_at', 'ASC']]
    });
    
    // Mark messages as read
    await Report.update(
      { is_opened: true, opened_at: new Date(), opened_count: sequelize.literal('opened_count + 1') },
      { where: { recipient_id: req.user.id, recipient_type: 'hospital', thread_id: threadId, is_opened: false } }
    );
    
    const formattedMessages = allMessages.map(msg => ({
      id: msg.id,
      report_number: msg.report_number,
      title: msg.title,
      body: msg.body,
      priority: msg.priority,
      sender_name: msg.sender_full_name,
      sender_type: msg.sender_type,
      sender_department: msg.sender_department || (msg.sender_type === 'hospital' ? 'Admin' : 'Staff'),
      sent_at: msg.sent_at,
      is_reply: !!msg.parent_report_id,
      parent_id: msg.parent_report_id
    }));
    
    res.json({ success: true, thread: formattedMessages, thread_id: threadId });
  } catch (error) {
    console.error("Get conversation thread error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      [Op.or]: [
        { sender_id: req.user.id, sender_type: 'hospital' },
        { recipient_id: req.user.id, recipient_type: 'hospital', parent_report_id: { [Op.not]: null } }
      ]
    };
    
    if (search) {
      whereClause[Op.and] = [{
        [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } }, { body: { [Op.iLike]: `%${search}%` } },
          { sender_full_name: { [Op.iLike]: `%${search}%` } }, { recipient_full_name: { [Op.iLike]: `%${search}%` } }
        ]
      }];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({ where: whereClause, order: [['sent_at', 'DESC']], limit: parseInt(limit), offset: parseInt(offset) });
    
    const formattedReports = reports.map(report => {
      const isSentByAdmin = report.sender_id === req.user.id && report.sender_type === 'hospital';
      return {
        ...report.toJSON(), display_type: isSentByAdmin ? 'sent' : 'reply_received',
        display_recipient: isSentByAdmin ? report.recipient_full_name : report.sender_full_name,
        display_recipient_type: isSentByAdmin ? report.recipient_type : report.sender_type,
        is_reply: !!report.parent_report_id
      };
    });
    
    res.json({ success: true, reports: formattedReports, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReportById = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [{ sender_id: req.user.id, sender_type: 'hospital' }, { recipient_id: req.user.id, recipient_type: 'hospital' }]
      }
    });
    
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    
    if (report.recipient_id === req.user.id && !report.is_opened) {
      await report.update({ is_opened: true, opened_at: new Date(), opened_count: (report.opened_count || 0) + 1 });
    }
    
    res.json({ success: true, report });
  } catch (error) {
    console.error("Get report by id error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const admin = req.user;
    
    if (!body) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }
    
    const parentReport = await Report.findByPk(id);
    if (!parentReport) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientDepartment = '';
    let recipientWard = '';
    
    if (parentReport.sender_type === 'staff') {
      recipient = await HospitalStaff.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientDepartment = recipient.department || '';
        recipientWard = recipient.ward || '';
      }
    } else if (parentReport.sender_type === 'kebele') {
      recipient = await KebeleAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
      }
    }
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    
    const report_number = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const threadId = parentReport.thread_id || parentReport.id;
    
    const reply = await Report.create({
      report_number, title: `Re: ${parentReport.title}`, subject: parentReport.subject, body,
      priority: parentReport.priority, status: 'sent', attachments: [],
      sender_id: admin.id, sender_type: 'hospital',
      sender_first_name: admin.first_name, sender_middle_name: admin.middle_name, sender_last_name: admin.last_name,
      sender_full_name: `${admin.first_name || ''} ${admin.middle_name || ''} ${admin.last_name || ''}`.trim(),
      sender_title: `Hospital Admin - ${admin.hospital_name}`, sender_hospital: admin.hospital_name, sender_hospital_id: admin.id,
      recipient_id: recipient.id, recipient_type: parentReport.sender_type,
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName, recipient_hospital: recipient.hospital_name, recipient_hospital_id: recipient.hospital_id,
      recipient_department: recipientDepartment, recipient_ward: recipientWard,
      parent_report_id: parentReport.id, thread_id: threadId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    
    await parentReport.update({ status: 'replied', last_activity_at: new Date(), reply_count: (parentReport.reply_count || 0) + 1 });
    
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'staff') {
        recipientRoom = `hospital_${recipient.hospital_id}_staff_${recipient.id}`;
      } else if (parentReport.sender_type === 'kebele') {
        recipientRoom = `kebele_${recipient.id}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_hospital', {
          report_id: reply.id, parent_report_id: parentReport.id, report_number: reply.report_number,
          title: reply.title, priority: reply.priority, sender_name: `${admin.first_name} ${admin.last_name}`,
          sender_department: 'Hospital Admin', sent_at: reply.sent_at, body_preview: body.substring(0, 100), is_reply: true
        });
      }
    }
    
    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error('Reply to report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markReportAsRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'hospital' }
    });
    
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    
    await report.update({ is_opened: true, opened_at: new Date(), opened_count: (report.opened_count || 0) + 1 });
    res.json({ success: true, message: "Report marked as read" });
  } catch (error) {
    console.error("Mark report read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== NOTIFICATION MANAGEMENT ====================

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'hospital' };
    if (unreadOnly === 'true') whereClause.is_read = false;
    
    const totalCount = await Notification.count({ where: whereClause });
    const notifications = await Notification.findAll({
      where: whereClause, order: [['createdAt', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    
    const unreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'hospital', is_read: false } });
    
    res.json({ success: true, notifications, unreadCount, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'hospital' }
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    
    await notification.update({ is_read: true, read_at: new Date() });
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.update({ is_read: true, read_at: new Date() }, {
      where: { recipient_id: req.user.id, recipient_type: 'hospital', is_read: false }
    });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ENHANCED DASHBOARD STATS WITH MORE CARDS ====================

export const getDashboardStats = async (req, res) => {
  try {
    const inboxCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'hospital' } });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'hospital', is_opened: false } });
    const outboxCount = await Report.count({ where: { sender_id: req.user.id, sender_type: 'hospital' } });
    const staffCount = await HospitalStaff.count({ where: { hospital_id: req.user.id, status: 'active' } });
    
    // Additional stats for better dashboard
    const doctorCount = await HospitalStaff.count({ where: { hospital_id: req.user.id, department: 'Doctor', status: 'active' } });
    const nurseCount = await HospitalStaff.count({ where: { hospital_id: req.user.id, department: 'Nurse', status: 'active' } });
    const urgentReportsCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'hospital', priority: 'urgent', is_opened: false } });
    const highPriorityCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'hospital', priority: 'high', is_opened: false } });
    
    const staffByDepartment = await HospitalStaff.findAll({
      where: { hospital_id: req.user.id, status: 'active' },
      attributes: ['department', [sequelize.fn('COUNT', sequelize.col('department')), 'count']],
      group: ['department']
    });
    
    const staffByWard = await HospitalStaff.findAll({
      where: { hospital_id: req.user.id, status: 'active', ward: { [Op.ne]: null } },
      attributes: ['ward', [sequelize.fn('COUNT', sequelize.col('ward')), 'count']],
      group: ['ward']
    });
    
    const departmentStats = {};
    staffByDepartment.forEach(item => { departmentStats[item.department] = parseInt(item.dataValues.count); });
    
    const wardStats = {};
    staffByWard.forEach(item => { wardStats[item.ward] = parseInt(item.dataValues.count); });
    
    // Get recent activity (last 5 reports)
    const recentReports = await Report.findAll({
      where: {
        [Op.or]: [
          { recipient_id: req.user.id, recipient_type: 'hospital' },
          { sender_id: req.user.id, sender_type: 'hospital' }
        ]
      },
      order: [['sent_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'title', 'priority', 'sender_full_name', 'sent_at', 'is_opened']
    });
    
    res.json({ 
      success: true, 
      stats: { 
        inbox: inboxCount, 
        unread: unreadCount, 
        outbox: outboxCount, 
        totalStaff: staffCount,
        doctorCount,
        nurseCount,
        urgentReportsCount,
        highPriorityCount,
        staffByDepartment: departmentStats,
        staffByWard: wardStats,
        recentReports
      } 
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ENHANCED REPORTING & ANALYTICS ====================

// Get report summary with filters (general and department-specific)
export const getReportSummary = async (req, res) => {
  try {
    const { type = 'general', department, ward, startDate, endDate } = req.query;
    
    let whereClause = {};
    
    if (startDate && endDate) {
      whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    
    let results = {};
    
    if (type === 'general') {
      // General statistics across all departments
      const totalPatients = await Patient.count({ where: { hospital_id: req.user.id } });
      const activeStaff = await HospitalStaff.count({ where: { hospital_id: req.user.id, status: 'active' } });
      const totalReports = await Report.count({
        where: {
          [Op.or]: [
            { sender_id: req.user.id, sender_type: 'hospital' },
            { recipient_id: req.user.id, recipient_type: 'hospital' }
          ],
          ...whereClause
        }
      });
      
      // Patient statistics by gender
      const malePatients = await Patient.count({ where: { hospital_id: req.user.id, gender: 'Male' } });
      const femalePatients = await Patient.count({ where: { hospital_id: req.user.id, gender: 'Female' } });
      
      // Patient statistics by age group
      const patients = await Patient.findAll({ where: { hospital_id: req.user.id }, attributes: ['age'] });
      let pediatric = 0, adult = 0, geriatric = 0;
      patients.forEach(p => {
        const age = parseInt(p.age);
        if (age < 18) pediatric++;
        else if (age >= 18 && age < 65) adult++;
        else if (age >= 65) geriatric++;
      });
      
      results = {
        totalPatients,
        activeStaff,
        totalReports,
        patientsByGender: { male: malePatients, female: femalePatients },
        patientsByAgeGroup: { pediatric, adult, geriatric },
        staffByDepartment: await getStaffCountByDepartment(req.user.id)
      };
    } 
    else if (type === 'by_department' && department) {
      results = await getDepartmentSpecificData(req.user.id, department, ward, whereClause);
    }
    else if (type === 'by_staff' && department) {
      results = await getStaffDetailedData(req.user.id, department, ward);
    }
    
    res.json({ success: true, data: results, reportType: type });
  } catch (error) {
    console.error("Get report summary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: Get staff count by department
async function getStaffCountByDepartment(hospitalId) {
  const staff = await HospitalStaff.findAll({
    where: { hospital_id: hospitalId, status: 'active' },
    attributes: ['department', [sequelize.fn('COUNT', sequelize.col('department')), 'count']],
    group: ['department']
  });
  
  const result = {};
  staff.forEach(s => { result[s.department] = parseInt(s.dataValues.count); });
  return result;
}

// Helper: Get department-specific data
async function getDepartmentSpecificData(hospitalId, department, ward, whereClause) {
  const staffInDept = await HospitalStaff.findAll({
    where: { hospital_id: hospitalId, department, status: 'active', ...(ward && { ward }) }
  });
  
  const staffIds = staffInDept.map(s => s.id);
  
  let specificData = {
    department,
    ward: ward || 'All',
    totalStaff: staffInDept.length,
    staffList: staffInDept.map(s => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      email: s.email,
      ward: s.ward
    }))
  };
  
  // Department-specific metrics
  switch(department) {
    case 'Doctor':
      const doctors = staffInDept;
      specificData.metrics = {
        totalDoctors: doctors.length,
        doctorsByWard: {}
      };
      doctors.forEach(doc => {
        const wardName = doc.ward || 'Unassigned';
        specificData.metrics.doctorsByWard[wardName] = (specificData.metrics.doctorsByWard[wardName] || 0) + 1;
      });
      break;
      
    case 'Nurse':
      specificData.metrics = {
        totalNurses: staffInDept.length,
        nursesByWard: {}
      };
      staffInDept.forEach(nurse => {
        const wardName = nurse.ward || 'Unassigned';
        specificData.metrics.nursesByWard[wardName] = (specificData.metrics.nursesByWard[wardName] || 0) + 1;
      });
      break;
      
    case 'Pharma':
      specificData.metrics = {
        totalPharmacists: staffInDept.length,
        // Placeholder for drug inventory data
        newDrugsAdded: 0,
        expiredDrugsCount: 0,
        lowStockAlert: false
      };
      break;
      
    case 'Lab':
      specificData.metrics = {
        totalLabTechs: staffInDept.length,
        equipmentStatus: 'Operational',
        pendingResults: 0,
        severeResults: 0,
        equipmentShortage: []
      };
      break;
      
    case 'Midwife':
      specificData.metrics = {
        totalMidwives: staffInDept.length,
        deliveriesThisMonth: 0,
        referrals: 0,
        highRiskPregnancies: 0
      };
      break;
      
    default:
      specificData.metrics = {
        totalStaff: staffInDept.length,
        activeCount: staffInDept.filter(s => s.status === 'active').length
      };
  }
  
  return specificData;
}

// Helper: Get detailed staff data for specific department
async function getStaffDetailedData(hospitalId, department, ward) {
  const whereClause = { hospital_id: hospitalId, department, status: 'active' };
  if (ward && ward !== 'all') whereClause.ward = ward;
  
  const staff = await HospitalStaff.findAll({
    where: whereClause,
    attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'phone', 'gender', 'age', 'department', 'ward', 'status']
  });
  
  const formattedStaff = staff.map(s => ({
    id: s.id,
    full_name: `${s.first_name} ${s.middle_name || ''} ${s.last_name}`.trim(),
    email: s.email,
    phone: s.phone,
    gender: s.gender,
    age: s.age,
    department: s.department,
    ward: s.ward,
    status: s.status
  }));
  
  // Additional metrics based on department
  let additionalMetrics = {};
  
  switch(department) {
    case 'Doctor':
      additionalMetrics = {
        patientAssignments: await getPatientCountByDoctor(staff.map(s => s.id)),
        surgeryCount: await getSurgeryCountByDoctor(staff.map(s => s.id)),
        referralsCount: await getReferralCountByDoctor(staff.map(s => s.id))
      };
      break;
    case 'Pharma':
      additionalMetrics = {
        newDrugs: await getNewDrugsList(hospitalId),
        expiredDrugs: await getExpiredDrugsList(hospitalId),
        lowStockItems: await getLowStockItems(hospitalId)
      };
      break;
    case 'Lab':
      additionalMetrics = {
        pendingResults: await getPendingLabResults(hospitalId),
        severeResults: await getSevereLabResults(hospitalId),
        equipmentShortage: await getEquipmentShortage(hospitalId)
      };
      break;
    case 'Midwife':
      additionalMetrics = {
        deliveries: await getDeliveryStats(hospitalId),
        referrals: await getMidwifeReferrals(hospitalId)
      };
      break;
  }
  
  return {
    department,
    ward: ward || 'All',
    staff: formattedStaff,
    totalStaff: formattedStaff.length,
    metrics: additionalMetrics
  };
}

// Mock data functions (replace with actual database queries)
async function getPatientCountByDoctor(doctorIds) { return {}; }
async function getSurgeryCountByDoctor(doctorIds) { return {}; }
async function getReferralCountByDoctor(doctorIds) { return {}; }
async function getNewDrugsList(hospitalId) { return []; }
async function getExpiredDrugsList(hospitalId) { return []; }
async function getLowStockItems(hospitalId) { return []; }
async function getPendingLabResults(hospitalId) { return 0; }
async function getSevereLabResults(hospitalId) { return 0; }
async function getEquipmentShortage(hospitalId) { return []; }
async function getDeliveryStats(hospitalId) { return { total: 0, normal: 0, csection: 0 }; }
async function getMidwifeReferrals(hospitalId) { return 0; }

// Get all available report types for dropdown
export const getReportTypes = async (req, res) => {
  try {
    const departments = await HospitalStaff.findAll({
      where: { hospital_id: req.user.id, status: 'active' },
      attributes: ['department'],
      group: ['department']
    });
    
    const departmentList = departments.map(d => d.department);
    
    const reportTypes = {
      general: {
        name: 'General Overview',
        description: 'View overall hospital statistics including patients, staff, and reports'
      },
      by_department: {
        name: 'Department Report',
        description: 'View detailed statistics for specific departments',
        departments: departmentList
      },
      by_staff: {
        name: 'Staff Performance Report',
        description: 'View individual staff member statistics and performance metrics',
        departments: departmentList
      }
    };
    
    // Add ward-based reports for applicable departments
    const wards = ['OPD', 'EME', 'ANC'];
    reportTypes.by_ward = {
      name: 'Ward Report',
      description: 'View statistics organized by ward',
      wards
    };
    
    res.json({ success: true, reportTypes });
  } catch (error) {
    console.error("Get report types error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get staff list for dropdown selection
export const getStaffListForReport = async (req, res) => {
  try {
    const { department } = req.query;
    
    const whereClause = { hospital_id: req.user.id, status: 'active' };
    if (department && department !== 'all') whereClause.department = department;
    
    const staff = await HospitalStaff.findAll({
      where: whereClause,
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'department', 'ward', 'email']
    });
    
    const formattedStaff = staff.map(s => ({
      id: s.id,
      name: `${s.first_name} ${s.middle_name || ''} ${s.last_name}`.trim(),
      department: s.department,
      ward: s.ward,
      email: s.email
    }));
    
    res.json({ success: true, staff: formattedStaff });
  } catch (error) {
    console.error("Get staff list error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get staff-specific detailed report
export const getStaffDetailedReport = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { includeMetrics = true } = req.query;
    
    const staff = await HospitalStaff.findOne({
      where: { id: staffId, hospital_id: req.user.id }
    });
    
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }
    
    const staffData = {
      id: staff.id,
      full_name: `${staff.first_name} ${staff.middle_name || ''} ${staff.last_name}`.trim(),
      email: staff.email,
      phone: staff.phone,
      gender: staff.gender,
      age: staff.age,
      department: staff.department,
      ward: staff.ward,
      status: staff.status,
      joined_date: staff.createdAt
    };
    
    let metrics = {};
    
    if (includeMetrics === 'true') {
      // Get reports sent/received by this staff
      const reportsSent = await Report.count({
        where: { sender_id: staff.id, sender_type: 'staff' }
      });
      
      const reportsReceived = await Report.count({
        where: { recipient_id: staff.id, recipient_type: 'staff' }
      });
      
      metrics = {
        reportsSent,
        reportsReceived,
        lastActive: staff.updatedAt
      };
      
      // Department-specific metrics
      switch(staff.department) {
        case 'Doctor':
          metrics.patientsTreated = await getPatientCountByDoctor([staff.id]);
          metrics.surgeriesPerformed = await getSurgeryCountByDoctor([staff.id]);
          break;
        case 'Pharma':
          metrics.dispensedCount = 0;
          metrics.pendingOrders = 0;
          break;
        case 'Lab':
          metrics.testsCompleted = 0;
          metrics.pendingTests = 0;
          break;
        case 'Midwife':
          metrics.deliveriesAttended = 0;
          metrics.currentPatients = 0;
          break;
      }
    }
    
    res.json({ success: true, staff: staffData, metrics });
  } catch (error) {
    console.error("Get staff detailed report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ADDITIONAL DASHBOARD CARDS ENDPOINTS ====================

export const getPatientStatistics = async (req, res) => {
  try {
    const totalPatients = await Patient.count({ where: { hospital_id: req.user.id } });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPatients = await Patient.count({
      where: { hospital_id: req.user.id, createdAt: { [Op.gte]: today } }
    });
    
    const patientsByGender = await Patient.findAll({
      where: { hospital_id: req.user.id },
      attributes: ['gender', [sequelize.fn('COUNT', sequelize.col('gender')), 'count']],
      group: ['gender']
    });
    
    const genderStats = { male: 0, female: 0, other: 0 };
    patientsByGender.forEach(p => {
      if (p.gender === 'Male') genderStats.male = parseInt(p.dataValues.count);
      else if (p.gender === 'Female') genderStats.female = parseInt(p.dataValues.count);
      else genderStats.other = parseInt(p.dataValues.count);
    });
    
    res.json({
      success: true,
      stats: {
        totalPatients,
        todayPatients,
        patientsByGender: genderStats
      }
    });
  } catch (error) {
    console.error("Get patient statistics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWardStatistics = async (req, res) => {
  try {
    const wards = ['OPD', 'EME', 'ANC'];
    const wardStats = {};
    
    for (const ward of wards) {
      const staffCount = await HospitalStaff.count({
        where: { hospital_id: req.user.id, ward, status: 'active' }
      });
      
      const staffByDepartment = await HospitalStaff.findAll({
        where: { hospital_id: req.user.id, ward, status: 'active' },
        attributes: ['department', [sequelize.fn('COUNT', sequelize.col('department')), 'count']],
        group: ['department']
      });
      
      const departments = {};
      staffByDepartment.forEach(d => { departments[d.department] = parseInt(d.dataValues.count); });
      
      wardStats[ward] = {
        totalStaff: staffCount,
        staffByDepartment: departments
      };
    }
    
    res.json({ success: true, wards: wardStats });
  } catch (error) {
    console.error("Get ward statistics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDepartmentWardMapping = async (req, res) => {
  try {
    const departments = ['Doctor', 'Nurse', 'Midwife', 'Pharma', 'Lab', 'Radio', 'Triage', 'Card_Office', 'Bed_Management', 'Human_Resource'];
    const mapping = {};
    
    for (const dept of departments) {
      const staff = await HospitalStaff.findAll({
        where: { hospital_id: req.user.id, department: dept, status: 'active' },
        attributes: ['ward', [sequelize.fn('COUNT', sequelize.col('ward')), 'count']],
        group: ['ward']
      });
      
      mapping[dept] = {};
      staff.forEach(s => {
        if (s.ward) mapping[dept][s.ward] = parseInt(s.dataValues.count);
        else mapping[dept]['Unassigned'] = (mapping[dept]['Unassigned'] || 0) + parseInt(s.dataValues.count);
      });
    }
    
    res.json({ success: true, departmentWardMapping: mapping });
  } catch (error) {
    console.error("Get department ward mapping error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
