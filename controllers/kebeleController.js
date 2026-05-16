import KebeleAdmin from "../models/KebeleAdmin.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import WoredaAdmin from "../models/WoredaAdmin.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import HospitalStaff from "../models/HospitalStaff.js";
import sequelize from "../config/database.js";
import { uploadToB2 } from "../Services/b2Upload.js";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";

// ==================== PROFILE MANAGEMENT ====================

export const getProfile = async (req, res) => {
  try {
    const kebele = await KebeleAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!kebele) {
      return res.status(404).json({ success: false, message: "Kebele admin not found" });
    }
    
    res.json({ success: true, kebele });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateKebeleProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone, kebele_name, woreda_name, address } = req.body;
    
    const kebele = await KebeleAdmin.findByPk(req.user.id);
    if (!kebele) {
      return res.status(404).json({ success: false, message: "Kebele admin not found" });
    }
    
    await kebele.update({
      first_name: first_name || kebele.first_name,
      middle_name: middle_name !== undefined ? middle_name : kebele.middle_name,
      last_name: last_name || kebele.last_name,
      gender: gender || kebele.gender,
      age: age || kebele.age,
      phone: phone !== undefined ? phone : kebele.phone,
      kebele_name: kebele_name || kebele.kebele_name,
      woreda_name: woreda_name || kebele.woreda_name,
      address: address !== undefined ? address : kebele.address
    });
    
    const updatedKebele = await KebeleAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ success: true, kebele: updatedKebele, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update kebele profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeKebelePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const kebele = await KebeleAdmin.findByPk(req.user.id);
    if (!kebele) {
      return res.status(404).json({ success: false, message: "Kebele admin not found" });
    }
    
    const isMatch = await bcrypt.compare(current_password, kebele.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await kebele.update({ password: hashedPassword });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== HOSPITAL MANAGEMENT ====================

export const createHospital = async (req, res) => {
  try {
    const { hospital_name, first_name, middle_name, last_name, gender, age, email, password, phone } = req.body;
    
    if (!hospital_name || !first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    const existingHospital = await HospitalAdmin.findOne({ where: { email } });
    if (existingHospital) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    
    const kebele = await KebeleAdmin.findByPk(req.user.id);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const hospital = await HospitalAdmin.create({
      kebele_id: req.user.id,
      hospital_name,
      first_name, middle_name, last_name, gender, age, email,
      password: hashedPassword, phone,
      service_type: "Public",
      hospital_type: "General",
      status: "active"
    });
    
    try {
      await Notification.create({
        title: "New Hospital Added",
        message: `${hospital_name} has been added under your kebele`,
        type: "success", priority: "medium",
        sender_id: req.user.id, sender_type: "kebele",
        sender_name: `${kebele.first_name} ${kebele.last_name}`,
        recipient_id: req.user.id, recipient_type: "kebele",
        recipient_name: `${kebele.first_name} ${kebele.last_name}`,
        related_user_id: hospital.id, related_user_type: "hospital",
        action_url: "/hospitals", action_text: "View Hospital"
      });
    } catch (notifError) {
      console.warn("⚠️ Notification creation failed:", notifError.message);
    }
    
    const created = await HospitalAdmin.findByPk(hospital.id, { attributes: { exclude: ['password'] } });
    res.status(201).json({ success: true, hospital: created, message: "Hospital admin created successfully" });
  } catch (error) {
    console.error("Create hospital error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitals = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { kebele_id: req.user.id };
    if (status && status !== 'all') whereClause.status = status;
    
    if (search) {
      whereClause[Op.or] = [
        { hospital_name: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const totalCount = await HospitalAdmin.count({ where: whereClause });
    const hospitals = await HospitalAdmin.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    
    const formattedHospitals = hospitals.map(hospital => ({
      id: hospital.id,
      name: hospital.hospital_name,
      admin_name: `${hospital.first_name} ${hospital.middle_name ? hospital.middle_name + ' ' : ''}${hospital.last_name}`.trim(),
      admin_email: hospital.email,
      admin_phone: hospital.phone,
      service_type: hospital.service_type,
      hospital_type: hospital.hospital_type,
      status: hospital.status,
      created_at: hospital.createdAt,
      code: `HOSP-${String(hospital.id).padStart(4, '0')}`
    }));
    
    res.json({ success: true, hospitals: formattedHospitals, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page), totalCount });
  } catch (error) {
    console.error("Get hospitals error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllHospitals = async (req, res) => {
  try {
    const hospitals = await HospitalAdmin.findAll({
      where: { kebele_id: req.user.id, status: 'active' },
      attributes: ['id', 'hospital_name', 'first_name', 'last_name', 'email']
    });
    
    const formattedHospitals = hospitals.map(hospital => ({
      id: hospital.id,
      name: hospital.hospital_name,
      admin_name: `${hospital.first_name} ${hospital.last_name}`.trim(),
      email: hospital.email
    }));
    
    res.json({ success: true, hospitals: formattedHospitals });
  } catch (error) {
    console.error("Get all hospitals error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== WOREDA MANAGEMENT ====================

export const getAllWoredas = async (req, res) => {
  try {
    const woredas = await WoredaAdmin.findAll({
      where: { status: 'active' },
      attributes: ['id', 'woreda_name', 'first_name', 'last_name', 'email', 'zone_id']
    });
    
    const formattedWoredas = woredas.map(woreda => ({
      id: woreda.id,
      name: woreda.woreda_name,
      admin_name: `${woreda.first_name} ${woreda.last_name}`.trim(),
      email: woreda.email,
      zone_id: woreda.zone_id
    }));
    
    res.json({ success: true, woredas: formattedWoredas });
  } catch (error) {
    console.error("Get all woredas error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalById = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await HospitalAdmin.findOne({
      where: { id, kebele_id: req.user.id },
      attributes: { exclude: ['password'] }
    });
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    
    res.json({ success: true, hospital });
  } catch (error) {
    console.error("Get hospital by id error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const { hospital_name, first_name, middle_name, last_name, gender, age, phone, status, service_type, hospital_type } = req.body;
    
    const hospital = await HospitalAdmin.findOne({ where: { id, kebele_id: req.user.id } });
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    
    await hospital.update({
      hospital_name: hospital_name || hospital.hospital_name,
      first_name: first_name || hospital.first_name,
      middle_name: middle_name !== undefined ? middle_name : hospital.middle_name,
      last_name: last_name || hospital.last_name,
      gender: gender || hospital.gender,
      age: age || hospital.age,
      phone: phone !== undefined ? phone : hospital.phone,
      status: status || hospital.status,
      service_type: service_type || hospital.service_type,
      hospital_type: hospital_type || hospital.hospital_type
    });
    
    const updated = await HospitalAdmin.findByPk(id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, hospital: updated, message: "Hospital updated successfully" });
  } catch (error) {
    console.error("Update hospital error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await HospitalAdmin.findOne({ where: { id, kebele_id: req.user.id } });
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    await hospital.update({ status: 'inactive' });
    res.json({ success: true, message: "Hospital deactivated successfully" });
  } catch (error) {
    console.error("Delete hospital error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalStats = async (req, res) => {
  try {
    const totalHospitals = await HospitalAdmin.count({ where: { kebele_id: req.user.id } });
    const activeHospitals = await HospitalAdmin.count({ where: { kebele_id: req.user.id, status: 'active' } });
    const inactiveHospitals = await HospitalAdmin.count({ where: { kebele_id: req.user.id, status: 'inactive' } });
    
    const hospitalsByType = await HospitalAdmin.findAll({
      where: { kebele_id: req.user.id },
      attributes: ['hospital_type', [sequelize.fn('COUNT', sequelize.col('hospital_type')), 'count']],
      group: ['hospital_type']
    });
    
    const typeStats = {};
    hospitalsByType.forEach(h => { typeStats[h.hospital_type] = parseInt(h.dataValues.count); });
    
    res.json({ success: true, stats: { totalHospitals, activeHospitals, inactiveHospitals, hospitalsByType: typeStats } });
  } catch (error) {
    console.error("Get hospital stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT WITH ATTACHMENTS ====================

export const sendReport = async (req, res) => {
  try {
    console.log("📝 Sending report...");
    console.log("   Files received:", req.files?.length || 0);
    
    const { title, body, priority, recipient_type, recipient_id } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: "Body is required" });
    }
    if (!recipient_type) {
      return res.status(400).json({ success: false, message: "Recipient type is required" });
    }
    if (!recipient_id) {
      return res.status(400).json({ success: false, message: "Recipient ID is required" });
    }
    
    const sender = await KebeleAdmin.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    let recipientWoredaId = null;
    
    if (recipient_type === 'woreda') {
      recipient = await WoredaAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientWoredaId = recipient.id;
      }
    } else if (recipient_type === 'hospital') {
      recipient = await HospitalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientHospitalId = recipient.id;
      }
    }
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }
    
    // ✅ GENERATE UNIQUE REPORT NUMBER
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const report_number = `RPT-${timestamp}-${randomString}`;
    
    console.log(`📋 Generated unique report number: ${report_number}`);
    
    // Process attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachments...`);
      
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToB2(file, sender.id);
          attachments.push({
            filename: uploadResult.originalName,
            originalName: uploadResult.originalName,
            mimeType: uploadResult.mimeType,
            size: uploadResult.size,
            url: uploadResult.url,
            key: uploadResult.key,
            expiresAt: uploadResult.expiresAt
          });
          console.log(`   ✅ Uploaded: ${uploadResult.originalName} -> Key: ${uploadResult.key}`);
        } catch (uploadError) {
          console.error(`   ❌ Failed to upload: ${file.originalname}`, uploadError.message);
        }
      }
    }
    
    const report = await Report.create({
      report_number, 
      title, 
      subject: title, 
      body, 
      priority: priority || 'medium', 
      status: 'sent',
      attachments: attachments,
      sender_id: sender.id, 
      sender_type: 'kebele',
      sender_first_name: sender.first_name, 
      sender_middle_name: sender.middle_name, 
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Kebele Admin - ${sender.kebele_name} Kebele`,
      sender_kebele: sender.kebele_name, 
      sender_kebele_id: sender.id,
      recipient_id: recipient.id, 
      recipient_type: recipient_type === 'woreda' ? 'woreda' : 'hospital',
      recipient_first_name: recipient.first_name, 
      recipient_middle_name: recipient.middle_name, 
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipient_type === 'hospital' ? recipient.hospital_name : '',
      recipient_hospital_id: recipientHospitalId,
      recipient_woreda_id: recipientWoredaId,
      sent_at: new Date(), 
      last_activity_at: new Date()
    });
    
    console.log(`✅ Report created with ID: ${report.id}, Attachments: ${attachments.length}`);
    
    // ... rest of your code (notifications, socket, response) ...
    
    res.status(201).json({ 
      success: true, 
      report: {
        id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        attachments_count: attachments.length,
        attachments: attachments
      }, 
      message: "Report sent successfully" 
    });
    
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'kebele' };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { sender_full_name: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({
      where: whereClause, 
      order: [['sent_at', 'DESC']],
      limit: parseInt(limit), 
      offset: parseInt(offset)
    });
    
    const formattedReports = reports.map(report => ({ 
      ...report.toJSON(), 
      is_reply: !!report.parent_report_id,
      attachments_count: report.attachments?.length || 0
    }));
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', is_opened: false, priority: 'urgent' } });
    
    res.json({ 
      success: true, 
      reports: formattedReports, 
      totalCount, 
      unreadCount, 
      urgentUnreadCount, 
      totalPages: Math.ceil(totalCount / limit), 
      currentPage: parseInt(page) 
    });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversationThread = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log(`🔍 Fetching conversation thread for report ID: ${reportId}`);
    
    const parentReport = await Report.findOne({
      where: {
        id: reportId,
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'kebele' },
          { recipient_id: req.user.id, recipient_type: 'kebele' }
        ]
      }
    });
    
    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    
    const threadId = parentReport.thread_id || parentReport.id;
    console.log(`📋 Thread ID: ${threadId}`);
    
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
    
    console.log(`📨 Found ${allMessages.length} messages in thread`);
    
    const formattedMessages = allMessages.map(msg => {
      let attachments = [];
      
      // Parse attachments from database
      if (msg.attachments) {
        if (typeof msg.attachments === 'string') {
          try {
            attachments = JSON.parse(msg.attachments);
          } catch(e) {
            attachments = [];
          }
        } else if (Array.isArray(msg.attachments)) {
          attachments = msg.attachments;
        }
      }
      
      // Format attachments - CRITICAL FIX HERE
      const formattedAttachments = attachments.map(att => {
        // Determine the key - check multiple possible locations
        let fileKey = att.key || att.fileKey || att.path;
        
        // If key is missing or invalid, try to construct from filename
        if (!fileKey || fileKey === 'undefined' || fileKey === 'null') {
          // If we have a filename but no key, try to construct the full path
          if (att.filename && att.filename !== 'file') {
            // For old data where only filename exists, we can't recover the full path
            // Mark as invalid so frontend knows
            fileKey = null;
            console.warn(`⚠️ Old attachment without valid key: ${att.originalName}`);
          } else {
            fileKey = null;
          }
        }
        
        // For Message 15 - fix the missing prefix
        if (fileKey && !fileKey.startsWith('attachments/') && fileKey.includes('-')) {
          // This looks like a filename without the path, can't recover
          console.warn(`⚠️ Attachment has filename without path: ${fileKey}`);
          fileKey = null;
        }
        
        return {
          filename: att.filename || att.key?.split('/').pop() || 'file',
          originalName: att.originalName || att.filename || 'Unknown',
          mimeType: att.mimeType || att.mimetype || 'application/octet-stream',
          size: att.size || 0,
          url: att.url || null,
          key: fileKey,  // Will be null for invalid attachments
          isValid: fileKey !== null && fileKey.startsWith('attachments/')
        };
      });
      
      console.log(`📎 Message ${msg.id} has ${formattedAttachments.length} attachments:`, 
        formattedAttachments.map(a => ({ key: a.key, name: a.originalName, valid: a.isValid })));
      
      return {
        id: msg.id,
        report_number: msg.report_number,
        title: msg.title,
        body: msg.body,
        priority: msg.priority,
        attachments: formattedAttachments,
        sender_name: msg.sender_full_name,
        sender_type: msg.sender_type,
        sent_at: msg.sent_at,
        is_reply: !!msg.parent_report_id,
        parent_id: msg.parent_report_id
      };
    });
    
    console.log(`✅ Returning ${formattedMessages.length} messages`);
    
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
        { sender_id: req.user.id, sender_type: 'kebele' },
        { recipient_id: req.user.id, recipient_type: 'kebele', parent_report_id: { [Op.not]: null } }
      ]
    };
    
    if (search) {
      whereClause[Op.and] = [{
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } }, 
          { body: { [Op.like]: `%${search}%` } },
          { sender_full_name: { [Op.like]: `%${search}%` } }, 
          { recipient_full_name: { [Op.like]: `%${search}%` } }
        ]
      }];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({ 
      where: whereClause, 
      order: [['sent_at', 'DESC']], 
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });
    
    const formattedReports = reports.map(report => {
      const isSentByKebele = report.sender_id === req.user.id && report.sender_type === 'kebele';
      return {
        ...report.toJSON(), 
        display_type: isSentByKebele ? 'sent' : 'reply_received',
        display_recipient: isSentByKebele ? report.recipient_full_name : report.sender_full_name,
        display_recipient_type: isSentByKebele ? report.recipient_type : report.sender_type,
        is_reply: !!report.parent_report_id,
        attachments_count: report.attachments?.length || 0
      };
    });
    
    res.json({ 
      success: true, 
      reports: formattedReports, 
      totalCount, 
      totalPages: Math.ceil(totalCount / limit), 
      currentPage: parseInt(page) 
    });
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
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'kebele' }, 
          { recipient_id: req.user.id, recipient_type: 'kebele' }
        ]
      }
    });
    
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    
    if (report.recipient_id === req.user.id && !report.is_opened) {
      await report.update({ is_opened: true, opened_at: new Date(), opened_count: (report.opened_count || 0) + 1 });
    }
    
    // Parse attachments if needed
    let attachments = report.attachments || [];
    if (typeof attachments === 'string') {
      try {
        attachments = JSON.parse(attachments);
      } catch(e) {
        attachments = [];
      }
    }
    
    res.json({ success: true, report: { ...report.toJSON(), attachments } });
  } catch (error) {
    console.error("Get report by id error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const kebele = req.user;
    
    console.log(`📝 Replying to report ${id}`);
    console.log(`   Body: ${body?.substring(0, 100)}...`);
    console.log(`   Files: ${req.files?.length || 0}`);
    
    if (!body && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: 'Reply message or attachment is required' });
    }
    
    const parentReport = await Report.findByPk(id);
    if (!parentReport) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    let recipientWoredaId = null;
    
    if (parentReport.sender_type === 'hospital') {
      recipient = await HospitalAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientHospitalId = recipient.id;
      }
    } else if (parentReport.sender_type === 'woreda') {
      recipient = await WoredaAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientWoredaId = recipient.id;
      }
    }
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    
    // Process attachments from files
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachment(s) for reply...`);
      
      for (const file of req.files) {
        try {
       const uploadResult = await uploadToB2(file, kebele.id);
attachments.push({
  filename: uploadResult.originalName,
  originalName: uploadResult.originalName,
  mimeType: uploadResult.mimeType,
  size: uploadResult.size,
  url: uploadResult.url,
  key: uploadResult.key,        // ← This is being saved now
  expiresAt: uploadResult.expiresAt
});
          console.log(`   ✅ Uploaded: ${uploadResult.originalName}`);
        } catch (uploadError) {
          console.error(`   ❌ Failed to upload: ${file.originalname}`, uploadError.message);
        }
      }
    }
    
    const report_number = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const threadId = parentReport.thread_id || parentReport.id;
    
    const reply = await Report.create({
      report_number, 
      title: `Re: ${parentReport.title}`, 
      subject: parentReport.subject, 
      body: body || '',
      priority: parentReport.priority, 
      status: 'sent', 
      attachments: attachments,  // Store as array
      sender_id: kebele.id, 
      sender_type: 'kebele',
      sender_first_name: kebele.first_name, 
      sender_middle_name: kebele.middle_name, 
      sender_last_name: kebele.last_name,
      sender_full_name: `${kebele.first_name || ''} ${kebele.middle_name || ''} ${kebele.last_name || ''}`.trim(),
      sender_title: `Kebele Admin - ${kebele.kebele_name} Kebele`, 
      sender_kebele: kebele.kebele_name, 
      sender_kebele_id: kebele.id,
      recipient_id: recipient.id, 
      recipient_type: parentReport.sender_type,
      recipient_first_name: recipient.first_name, 
      recipient_middle_name: recipient.middle_name, 
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName, 
      recipient_hospital: recipient.hospital_name, 
      recipient_hospital_id: recipientHospitalId,
      recipient_woreda_id: recipientWoredaId,
      parent_report_id: parentReport.id, 
      thread_id: threadId,
      sent_at: new Date(), 
      last_activity_at: new Date()
    });
    
    console.log(`✅ Reply created with ID: ${reply.id}, Attachments: ${attachments.length}`);
    
    await parentReport.update({ 
      status: 'replied', 
      last_activity_at: new Date(), 
      reply_count: (parentReport.reply_count || 0) + 1 
    });
    
    // Create notification
    try {
      await Notification.create({
        recipient_id: recipient.id,
        recipient_type: parentReport.sender_type,
        title: `Reply to: ${parentReport.title}`,
        message: `You have received a reply from ${kebele.first_name} ${kebele.last_name}`,
        type: 'reply_received',
        priority: parentReport.priority,
        reference_id: reply.id,
        is_read: false
      });
    } catch (notifError) {
      console.error("Error creating notification:", notifError);
    }
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'hospital') {
        recipientRoom = `hospital_${recipient.id}_admin`;
      } else if (parentReport.sender_type === 'woreda') {
        recipientRoom = `woreda_${recipient.id}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_kebele', {
          report_id: reply.id, 
          parent_report_id: parentReport.id, 
          report_number: reply.report_number,
          title: reply.title, 
          priority: reply.priority, 
          sender_name: `${kebele.first_name} ${kebele.last_name}`,
          sender_department: 'Kebele Admin', 
          sent_at: reply.sent_at, 
          body_preview: (body || '').substring(0, 100), 
          is_reply: true,
          has_attachments: attachments.length > 0
        });
      }
    }
    
    res.json({ 
      success: true, 
      reply: {
        id: reply.id,
        title: reply.title,
        body: reply.body,
        attachments: attachments,
        sent_at: reply.sent_at
      }, 
      message: "Reply sent successfully" 
    });
  } catch (error) {
    console.error('Reply to report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markReportAsRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'kebele' }
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
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'kebele' };
    if (unreadOnly === 'true') whereClause.is_read = false;
    
    const totalCount = await Notification.count({ where: whereClause });
    const notifications = await Notification.findAll({
      where: whereClause, 
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), 
      offset: parseInt(offset)
    });
    
    const unreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', is_read: false } });
    const urgentUnreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', is_read: false, priority: 'urgent' } });
    
    res.json({ 
      success: true, 
      notifications, 
      unreadCount, 
      urgentUnreadCount, 
      totalCount, 
      totalPages: Math.ceil(totalCount / limit), 
      currentPage: parseInt(page) 
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'kebele' }
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
      where: { recipient_id: req.user.id, recipient_type: 'kebele', is_read: false }
    });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DASHBOARD STATS ====================

export const getDashboardStats = async (req, res) => {
  try {
    const inboxCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele' } });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', is_opened: false, priority: 'urgent' } });
    const outboxCount = await Report.count({ where: { sender_id: req.user.id, sender_type: 'kebele' } });
    const hospitalsCount = await HospitalAdmin.count({ where: { kebele_id: req.user.id, status: 'active' } });
    const closedReportsCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'kebele', status: 'closed' } });
    
    const recentReports = await Report.findAll({
      where: {
        [Op.or]: [
          { recipient_id: req.user.id, recipient_type: 'kebele' },
          { sender_id: req.user.id, sender_type: 'kebele' }
        ]
      },
      order: [['sent_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'title', 'priority', 'sender_full_name', 'sent_at', 'is_opened', 'status', 'attachments']
    });
    
    res.json({ 
      success: true, 
      stats: { 
        inbox: inboxCount, 
        unread: unreadCount,
        urgentUnread: urgentUnreadCount,
        outbox: outboxCount, 
        hospitals: hospitalsCount,
        closed: closedReportsCount,
        recentReports
      } 
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReportStatistics = async (req, res) => {
  try {
    const reportsByPriority = await Report.findAll({
      where: { recipient_id: req.user.id, recipient_type: 'kebele' },
      attributes: ['priority', [sequelize.fn('COUNT', sequelize.col('priority')), 'count']],
      group: ['priority']
    });
    
    const reportsByStatus = await Report.findAll({
      where: { recipient_id: req.user.id, recipient_type: 'kebele' },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status']
    });
    
    const priorityStats = {};
    reportsByPriority.forEach(r => { priorityStats[r.priority] = parseInt(r.dataValues.count); });
    
    const statusStats = {};
    reportsByStatus.forEach(r => { statusStats[r.status] = parseInt(r.dataValues.count); });
    
    res.json({ success: true, stats: { byPriority: priorityStats, byStatus: statusStats } });
  } catch (error) {
    console.error("Get report statistics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalStatistics = async (req, res) => {
  try {
    const hospitals = await HospitalAdmin.findAll({
      where: { kebele_id: req.user.id },
      attributes: ['id', 'hospital_name', 'status', 'service_type', 'hospital_type', 'createdAt']
    });
    
    const hospitalReportCounts = {};
    for (const hospital of hospitals) {
      const reportsFromHospital = await Report.count({
        where: { sender_id: hospital.id, sender_type: 'hospital' }
      });
      const reportsToHospital = await Report.count({
        where: { recipient_id: hospital.id, recipient_type: 'hospital' }
      });
      hospitalReportCounts[hospital.id] = { sent: reportsFromHospital, received: reportsToHospital };
    }
    
    res.json({ success: true, hospitals, reportCounts: hospitalReportCounts });
  } catch (error) {
    console.error("Get hospital statistics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ENHANCED REPORTING & ANALYTICS ====================

export const getReportSummary = async (req, res) => {
  try {
    const { type = 'general', startDate, endDate } = req.query;
    
    let whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    
    let results = {};
    
    if (type === 'general') {
      const totalHospitals = await HospitalAdmin.count({ where: { kebele_id: req.user.id } });
      const activeHospitals = await HospitalAdmin.count({ where: { kebele_id: req.user.id, status: 'active' } });
      const totalReports = await Report.count({
        where: {
          [Op.or]: [
            { sender_id: req.user.id, sender_type: 'kebele' },
            { recipient_id: req.user.id, recipient_type: 'kebele' }
          ],
          ...whereClause
        }
      });
      
      const reportsByPriority = await Report.findAll({
        where: { recipient_id: req.user.id, recipient_type: 'kebele', ...whereClause },
        attributes: ['priority', [sequelize.fn('COUNT', sequelize.col('priority')), 'count']],
        group: ['priority']
      });
      
      const priorityStats = {};
      reportsByPriority.forEach(r => { priorityStats[r.priority] = parseInt(r.dataValues.count); });
      
      results = {
        totalHospitals,
        activeHospitals,
        totalReports,
        reportsByPriority: priorityStats
      };
    }
    
    res.json({ success: true, data: results, reportType: type });
  } catch (error) {
    console.error("Get report summary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReportTypes = async (req, res) => {
  try {
    const reportTypes = {
      general: {
        name: 'General Overview',
        description: 'View overall kebele statistics including hospitals and reports'
      },
      hospitals: {
        name: 'Hospitals Report',
        description: 'View detailed statistics for hospitals under your kebele'
      },
      communications: {
        name: 'Communications Report',
        description: 'View report statistics by priority and status'
      }
    };
    
    res.json({ success: true, reportTypes });
  } catch (error) {
    console.error("Get report types error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalListForReport = async (req, res) => {
  try {
    const hospitals = await HospitalAdmin.findAll({
      where: { kebele_id: req.user.id, status: 'active' },
      attributes: ['id', 'hospital_name', 'first_name', 'last_name', 'email']
    });
    
    const formattedHospitals = hospitals.map(h => ({
      id: h.id,
      name: h.hospital_name,
      admin_name: `${h.first_name} ${h.last_name}`.trim(),
      email: h.email
    }));
    
    res.json({ success: true, hospitals: formattedHospitals });
  } catch (error) {
    console.error("Get hospital list error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalDetailedReport = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    const hospital = await HospitalAdmin.findOne({
      where: { id: hospitalId, kebele_id: req.user.id }
    });
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    
    const reportsSent = await Report.count({
      where: { sender_id: hospital.id, sender_type: 'hospital' }
    });
    
    const reportsReceived = await Report.count({
      where: { recipient_id: hospital.id, recipient_type: 'hospital' }
    });
    
    const hospitalData = {
      id: hospital.id,
      name: hospital.hospital_name,
      admin_name: `${hospital.first_name} ${hospital.last_name}`.trim(),
      email: hospital.email,
      phone: hospital.phone,
      status: hospital.status,
      service_type: hospital.service_type,
      hospital_type: hospital.hospital_type,
      joined_date: hospital.createdAt
    };
    
    res.json({ success: true, hospital: hospitalData, metrics: { reportsSent, reportsReceived } });
  } catch (error) {
    console.error("Get hospital detailed report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== HOSPITAL STAFF MANAGEMENT ====================

export const getHospitalStaff = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    const hospital = await HospitalAdmin.findOne({
      where: { 
        id: hospitalId, 
        kebele_id: req.user.id 
      }
    });
    
    if (!hospital) {
      return res.status(404).json({ 
        success: false, 
        message: "Hospital not found or not under your kebele" 
      });
    }
    
    const staff = await HospitalStaff.findAll({
      where: { hospital_id: hospitalId, status: 'active' },
      attributes: { exclude: ['password'] },
      order: [['department', 'ASC'], ['first_name', 'ASC']]
    });
    
    const formattedStaff = staff.map(s => ({
      id: s.id,
      first_name: s.first_name,
      middle_name: s.middle_name,
      last_name: s.last_name,
      full_name: s.getFullName ? s.getFullName() : `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`,
      gender: s.gender,
      age: s.age,
      email: s.email,
      phone: s.phone,
      department: s.department,
      ward: s.ward,
      role: s.role,
      specialization: s.specialization,
      qualifications: s.qualifications,
      years_of_experience: s.years_of_experience,
      available_for_scheduling: s.available_for_scheduling,
      profile_picture: s.profile_picture,
      languages: s.languages,
      bio: s.bio,
      skills: s.skills,
      status: s.status
    }));
    
    res.json({ 
      success: true, 
      staff: formattedStaff,
      total: formattedStaff.length,
      hospital_name: hospital.hospital_name
    });
    
  } catch (error) {
    console.error("Get hospital staff error:", error);
    res.json({ 
      success: true, 
      staff: [],
      total: 0,
      message: error.message || "No staff members found"
    });
  }
};

export const getHospitalStaffStats = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    const hospital = await HospitalAdmin.findOne({
      where: { id: hospitalId, kebele_id: req.user.id }
    });
    
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    
    const departmentStats = await HospitalStaff.findAll({
      where: { hospital_id: hospitalId, status: 'active' },
      attributes: ['department', [sequelize.fn('COUNT', sequelize.col('department')), 'count']],
      group: ['department']
    });
    
    const genderStats = await HospitalStaff.findAll({
      where: { hospital_id: hospitalId, status: 'active' },
      attributes: ['gender', [sequelize.fn('COUNT', sequelize.col('gender')), 'count']],
      group: ['gender']
    });
    
    const byDepartment = {};
    departmentStats.forEach(d => { byDepartment[d.department] = parseInt(d.dataValues.count); });
    
    const allDepartments = ['Doctor', 'Nurse', 'Midwife', 'Pharma', 'Lab', 'Radio', 'Triage', 'Card_Office', 'Bed_Management', 'Human_Resource'];
    allDepartments.forEach(dept => {
      if (!byDepartment[dept]) byDepartment[dept] = 0;
    });
    
    const byGender = {};
    genderStats.forEach(g => { byGender[g.gender] = parseInt(g.dataValues.count); });
    
    res.json({ 
      success: true, 
      stats: {
        byDepartment,
        byGender,
        total: await HospitalStaff.count({ where: { hospital_id: hospitalId, status: 'active' } })
      }
    });
    
  } catch (error) {
    console.error("Get hospital staff stats error:", error);
    res.json({ 
      success: true, 
      stats: {
        byDepartment: {},
        byGender: {},
        total: 0
      }
    });
  }
};