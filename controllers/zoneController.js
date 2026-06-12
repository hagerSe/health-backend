import ZoneAdmin from "../models/ZoneAdmin.js";
import WoredaAdmin from "../models/WoredaAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import { uploadToB2 } from "../Services/b2Upload.js";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import sequelize from "../config/database.js";  // ✅ ADD THIS - CRITICAL FIX

// ==================== PROFILE MANAGEMENT ====================

export const getProfile = async (req, res) => {
  try {
    const zone = await ZoneAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: "Zone admin not found" 
      });
    }
    
    res.json({ 
      success: true, 
      zone 
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, phone, gender, age } = req.body;
    
    const zone = await ZoneAdmin.findByPk(req.user.id);
    
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: "Zone admin not found" 
      });
    }
    
    await zone.update({
      first_name: first_name || zone.first_name,
      middle_name: middle_name !== undefined ? middle_name : zone.middle_name,
      last_name: last_name || zone.last_name,
      phone: phone !== undefined ? phone : zone.phone,
      gender: gender || zone.gender,
      age: age || zone.age
    });
    
    const updatedZone = await ZoneAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      zone: updatedZone,
      message: "Profile updated successfully" 
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const zone = await ZoneAdmin.findByPk(req.user.id);
    
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: "Zone admin not found" 
      });
    }
    
    const isMatch = await bcrypt.compare(current_password, zone.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await zone.update({ password: hashedPassword });
    
    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REGIONAL INFO ====================

export const getRegionalInfo = async (req, res) => {
  try {
    const zoneAdmin = await ZoneAdmin.findByPk(req.user.id);
    
    if (!zoneAdmin) {
      return res.status(404).json({
        success: false,
        message: "Zone admin not found"
      });
    }
    
    if (!zoneAdmin.regional_id) {
      return res.json({
        success: false,
        message: "No regional admin associated with this zone",
        regional: null
      });
    }
    
    const regionalAdmin = await RegionalAdmin.findByPk(zoneAdmin.regional_id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!regionalAdmin) {
      return res.json({
        success: false,
        message: "Regional admin not found",
        regional: null
      });
    }
    
    const regionalData = {
      id: regionalAdmin.id,
      first_name: regionalAdmin.first_name,
      last_name: regionalAdmin.last_name,
      full_name: `${regionalAdmin.first_name || ''} ${regionalAdmin.last_name || ''}`.trim(),
      email: regionalAdmin.email,
      phone: regionalAdmin.phone,
      region_name: regionalAdmin.region_name
    };
    
    res.json({
      success: true,
      regional: regionalData
    });
    
  } catch (error) {
    console.error("Error in getRegionalInfo:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      regional: null
    });
  }
};

// ==================== WOREDA ADMIN MANAGEMENT ====================

export const getWoredasForReport = async (req, res) => {
  try {
    const woredas = await WoredaAdmin.findAll({
      where: { 
        zone_id: req.user.id,
        status: 'active'
      },
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'woreda_name', 'status']
    });
    
    const formattedWoredas = woredas.map(w => ({
      id: w.id,
      first_name: w.first_name,
      last_name: w.last_name,
      full_name: `${w.first_name} ${w.last_name}`.trim(),
      email: w.email,
      phone: w.phone,
      woreda_name: w.woreda_name,
      status: w.status,
      type: 'woreda'
    }));
    
    res.json({
      success: true,
      woredas: formattedWoredas,
      count: formattedWoredas.length
    });
    
  } catch (error) {
    console.error("Error in getWoredasForReport:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getWoredas = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', showInactive = false } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { zone_id: req.user.id };
    
    if (!showInactive) {
      whereClause.status = 'active';
    }
    
    if (search) {
      whereClause[Op.or] = [
        { woreda_name: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const totalCount = await WoredaAdmin.count({ where: whereClause });
    
    const woredas = await WoredaAdmin.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const formattedWoredas = woredas.map(woreda => ({
      id: woreda.id,
      woreda_name: woreda.woreda_name,
      name: woreda.woreda_name,
      first_name: woreda.first_name,
      last_name: woreda.last_name,
      admin_name: `${woreda.first_name} ${woreda.last_name}`,
      email: woreda.email,
      phone: woreda.phone,
      gender: woreda.gender,
      age: woreda.age,
      status: woreda.status
    }));
    
    res.json({ 
      success: true, 
      woredas: formattedWoredas,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      totalCount
    });
  } catch (error) {
    console.error("Get woredas error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createWoredaAdmin = async (req, res) => {
  try {
    const { 
      woreda_name, first_name, middle_name, last_name, 
      gender, age, email, password, phone 
    } = req.body;
    
    const existingAdmin = await WoredaAdmin.findOne({ where: { email } });
    
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    
    const woredaAdmin = await WoredaAdmin.create({
      zone_id: req.user.id,
      woreda_name,
      first_name,
      middle_name,
      last_name,
      gender,
      age,
      email,
      password,
      phone,
      role: "Woreda_Admin",
      status: "active"
    });
    
    const created = await WoredaAdmin.findByPk(woredaAdmin.id, {
      attributes: { exclude: ['password'] }
    });
    
    const formattedWoreda = {
      id: created.id,
      woreda_name: created.woreda_name,
      name: created.woreda_name,
      first_name: created.first_name,
      last_name: created.last_name,
      admin_name: `${created.first_name} ${created.last_name}`,
      email: created.email,
      phone: created.phone,
      gender: created.gender,
      age: created.age,
      status: created.status
    };
    
    res.status(201).json({ 
      success: true, 
      woredaAdmin: formattedWoreda,
      message: "Woreda admin created successfully" 
    });
  } catch (error) {
    console.error("Create woreda admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWoredaAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { woreda_name, first_name, middle_name, last_name, gender, age, phone, status } = req.body;
    
    const woredaAdmin = await WoredaAdmin.findOne({
      where: { id, zone_id: req.user.id }
    });
    
    if (!woredaAdmin) {
      return res.status(404).json({ success: false, message: "Woreda admin not found" });
    }
    
    await woredaAdmin.update({
      woreda_name: woreda_name || woredaAdmin.woreda_name,
      first_name: first_name || woredaAdmin.first_name,
      middle_name: middle_name !== undefined ? middle_name : woredaAdmin.middle_name,
      last_name: last_name || woredaAdmin.last_name,
      gender: gender || woredaAdmin.gender,
      age: age || woredaAdmin.age,
      phone: phone !== undefined ? phone : woredaAdmin.phone,
      status: status || woredaAdmin.status
    });
    
    const updated = await WoredaAdmin.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
    
    const formattedWoreda = {
      id: updated.id,
      woreda_name: updated.woreda_name,
      name: updated.woreda_name,
      first_name: updated.first_name,
      last_name: updated.last_name,
      admin_name: `${updated.first_name} ${updated.last_name}`,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      age: updated.age,
      status: updated.status
    };
    
    res.json({ 
      success: true, 
      woredaAdmin: formattedWoreda,
      message: "Woreda admin updated successfully" 
    });
  } catch (error) {
    console.error("Update woreda admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteWoredaAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const woredaAdmin = await WoredaAdmin.findOne({
      where: { id, zone_id: req.user.id }
    });
    
    if (!woredaAdmin) {
      return res.status(404).json({ success: false, message: "Woreda admin not found" });
    }
    
    await woredaAdmin.update({ status: 'inactive' });
    
    res.json({ success: true, message: "Woreda admin deactivated successfully" });
  } catch (error) {
    console.error("Delete woreda admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT ====================

export const sendReport = async (req, res) => {
  try {
    console.log("📝 Sending report from Zone...");
    console.log("   Request body:", req.body);
    console.log("   Files received:", req.files?.length || 0);
    
    const { title, body, priority, recipient_type, recipient_id } = req.body;
    
    // ============================================================
    // ✅ ADD VALIDATION - FIX FOR "NO RECIPIENT SELECTED" ERROR
    // ============================================================
    if (!recipient_type) {
      return res.status(400).json({ 
        success: false, 
        message: "Please select a recipient type (regional or woreda)" 
      });
    }
    
    if (!recipient_id) {
      return res.status(400).json({ 
        success: false, 
        message: "Please select a recipient from the list" 
      });
    }
    
    if (!title || title.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a title for the report" 
      });
    }
    
    if (!body || body.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter the report content" 
      });
    }
    
    const sender = await ZoneAdmin.findByPk(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ 
        success: false, 
        message: "Sender not found" 
      });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientRegionalId = null;
    let recipientWoredaId = null;
    
    // ============================================================
    // ✅ IMPROVED RECIPIENT LOOKUP WITH VALIDATION
    // ============================================================
    if (recipient_type === 'regional') {
      recipient = await RegionalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name || ''}`.trim();
        recipientRegionalId = recipient.id;
        console.log(`✅ Found regional recipient: ${recipientFullName} (ID: ${recipient.id})`);
      } else {
        return res.status(404).json({ 
          success: false, 
          message: `Regional admin with ID ${recipient_id} not found. Please select a valid regional admin.` 
        });
      }
    } else if (recipient_type === 'woreda') {
      // ✅ Ensure woreda belongs to this zone
      recipient = await WoredaAdmin.findOne({ 
        where: { 
          id: recipient_id,
          zone_id: req.user.id,
          status: 'active'
        } 
      });
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name || ''}`.trim();
        recipientWoredaId = recipient.id;
        console.log(`✅ Found woreda recipient: ${recipientFullName} (ID: ${recipient.id})`);
      } else {
        return res.status(404).json({ 
          success: false, 
          message: `Woreda admin with ID ${recipient_id} not found under your zone. Please select a valid woreda admin.` 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid recipient type: ${recipient_type}. Must be 'regional' or 'woreda'` 
      });
    }
    
    // Generate unique report number
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const report_number = `RPT-${timestamp}-${randomString}`;
    
    console.log(`📋 Generated unique report number: ${report_number}`);
    
    // ============================================================
    // ✅ PROCESS ATTACHMENTS
    // ============================================================
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
    
    // ============================================================
    // ✅ CREATE REPORT
    // ============================================================
    const report = await Report.create({
      report_number, 
      title: title.trim(), 
      subject: title.trim(), 
      body: body.trim(), 
      priority: priority || 'medium', 
      status: 'sent',
      attachments: attachments,
      sender_id: sender.id, 
      sender_type: 'zone',
      sender_first_name: sender.first_name, 
      sender_middle_name: sender.middle_name, 
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name || ''} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name || ''}`.trim(),
      sender_title: `Zone Admin - ${sender.zone_name}`,
      sender_zone: sender.zone_name,
      sender_zone_id: sender.id,
      recipient_id: recipient.id, 
      recipient_type: recipient_type === 'regional' ? 'regional' : 'woreda',
      recipient_first_name: recipient.first_name, 
      recipient_middle_name: recipient.middle_name, 
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_region: recipient_type === 'regional' ? (recipient.region_name || '') : '',
      recipient_region_id: recipientRegionalId,
      recipient_woreda: recipient_type === 'woreda' ? (recipient.woreda_name || '') : '',
      recipient_woreda_id: recipientWoredaId,
      sent_at: new Date(), 
      last_activity_at: new Date()
    });
    
    console.log(`✅ Report created with ID: ${report.id}, Attachments: ${attachments.length}`);
    
    // ============================================================
    // ✅ SEND REAL-TIME NOTIFICATION VIA SOCKET.IO
    // ============================================================
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (recipient_type === 'regional') {
        recipientRoom = `regional_${recipientRegionalId}`;
      } else if (recipient_type === 'woreda') {
        recipientRoom = `woreda_${recipientWoredaId}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('new_report_from_zone', {
          report_id: report.id, 
          report_number: report.report_number, 
          title: report.title,
          priority: report.priority, 
          sender_name: `${sender.first_name || ''} ${sender.last_name || ''}`.trim(),
          sender_zone: sender.zone_name,
          sent_at: report.sent_at, 
          body_preview: body?.substring(0, 100), 
          body: body,
          has_attachments: attachments.length > 0
        });
        console.log(`📡 Socket notification sent to room: ${recipientRoom}`);
      }
    }
    
    // ============================================================
    // ✅ CREATE DATABASE NOTIFICATION
    // ============================================================
    try {
      await Notification.create({
        recipient_id: recipient.id,
        recipient_type: recipient_type,
        title: `New Report from Zone: ${title}`,
        message: `You have received a new report from ${sender.zone_name} zone`,
        type: 'report_received',
        priority: priority || 'medium',
        reference_id: report.id,
        is_read: false,
        created_at: new Date()
      });
      console.log(`📧 Database notification created for recipient`);
    } catch (notifError) {
      console.warn("⚠️ Notification creation failed:", notifError.message);
    }
    
    // ============================================================
    // ✅ SUCCESS RESPONSE
    // ============================================================
    res.status(201).json({ 
      success: true, 
      report: {
        id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        attachments_count: attachments.length,
        attachments: attachments,
        sent_at: report.sent_at
      }, 
      message: "Report sent successfully" 
    });
    
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to send report. Please try again." 
    });
  }
};

export const getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'zone' };
    
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
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'zone', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'zone', is_opened: false, priority: 'urgent' } });
    
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

export const getOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      sender_id: req.user.id, 
      sender_type: 'zone'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { recipient_full_name: { [Op.like]: `%${search}%` } }
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
      display_recipient: report.recipient_full_name,
      display_recipient_type: report.recipient_type,
      is_reply: !!report.parent_report_id,
      attachments_count: report.attachments?.length || 0
    }));
    
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

// ==================== CONVERSATION THREAD ====================

export const getConversationThread = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const parentReport = await Report.findOne({
      where: {
        id: reportId,
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'zone' },
          { recipient_id: req.user.id, recipient_type: 'zone' }
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
    
    // ✅ FIXED: Use sequelize.literal correctly
    await Report.update(
      { 
        is_opened: true, 
        opened_at: new Date(), 
        opened_count: sequelize.literal('opened_count + 1') 
      },
      { 
        where: { 
          recipient_id: req.user.id, 
          recipient_type: 'zone', 
          thread_id: threadId, 
          is_opened: false 
        } 
      }
    );
    
    const formattedMessages = allMessages.map(msg => {
      let attachments = [];
      
      if (msg.attachments) {
        if (typeof msg.attachments === 'string') {
          try {
            attachments = JSON.parse(msg.attachments);
          } catch(e) {
            attachments = [];
          }
        } else if (Array.isArray(msg.attachments)) {
          attachments = msg.attachments;
        } else if (typeof msg.attachments === 'object') {
          attachments = [msg.attachments];
        }
      }
      
      const formattedAttachments = attachments.map(att => ({
        filename: att.filename || att.key?.split('/').pop() || 'file',
        originalName: att.originalName || att.filename || 'Unknown',
        mimeType: att.mimeType || att.mimetype || 'application/octet-stream',
        size: att.size || 0,
        url: att.url || null,
        key: att.key || att.filename,
        expiresAt: att.expiresAt || null
      }));
      
      return {
        id: msg.id,
        report_number: msg.report_number,
        title: msg.title,
        body: msg.body,
        priority: msg.priority,
        attachments: formattedAttachments,
        sender_name: msg.sender_full_name,
        sender_type: msg.sender_type,
        sender_department: msg.sender_department || (
          msg.sender_type === 'woreda' ? 'Woreda Admin' : 
          msg.sender_type === 'regional' ? 'Regional Admin' : 
          'Zone Admin'
        ),
        sent_at: msg.sent_at,
        is_reply: !!msg.parent_report_id,
        parent_id: msg.parent_report_id
      };
    });
    
    res.json({ success: true, thread: formattedMessages, thread_id: threadId });
  } catch (error) {
    console.error("Get conversation thread error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReportById = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'zone' }, 
          { recipient_id: req.user.id, recipient_type: 'zone' }
        ]
      }
    });
    
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    
    if (report.recipient_id === req.user.id && !report.is_opened) {
      await report.update({ is_opened: true, opened_at: new Date(), opened_count: (report.opened_count || 0) + 1 });
    }
    
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
    const zone = req.user;
    
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
    let recipientRegionalId = null;
    let recipientWoredaId = null;
    
    if (parentReport.sender_type === 'regional') {
      recipient = await RegionalAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientRegionalId = recipient.id;
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
    
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachment(s) for reply...`);
      
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToB2(file, zone.id);
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
    
    const report_number = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const threadId = parentReport.thread_id || parentReport.id;
    
    const reply = await Report.create({
      report_number, 
      title: `Re: ${parentReport.title}`, 
      subject: parentReport.subject, 
      body: body || '',
      priority: parentReport.priority, 
      status: 'sent', 
      attachments: attachments,
      sender_id: zone.id, 
      sender_type: 'zone',
      sender_first_name: zone.first_name, 
      sender_middle_name: zone.middle_name, 
      sender_last_name: zone.last_name,
      sender_full_name: `${zone.first_name || ''} ${zone.middle_name || ''} ${zone.last_name || ''}`.trim(),
      sender_title: `Zone Admin - ${zone.zone_name}`, 
      sender_zone: zone.zone_name, 
      sender_zone_id: zone.id,
      recipient_id: recipient.id, 
      recipient_type: parentReport.sender_type,
      recipient_first_name: recipient.first_name, 
      recipient_middle_name: recipient.middle_name, 
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_region: parentReport.sender_type === 'regional' ? recipient.region_name : '',
      recipient_region_id: recipientRegionalId,
      recipient_woreda: parentReport.sender_type === 'woreda' ? recipient.woreda_name : '',
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
    
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'regional') {
        recipientRoom = `regional_${recipient.id}`;
      } else if (parentReport.sender_type === 'woreda') {
        recipientRoom = `woreda_${recipient.id}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_zone', {
          report_id: reply.id, 
          parent_report_id: parentReport.id, 
          report_number: reply.report_number,
          title: reply.title, 
          priority: reply.priority, 
          sender_name: `${zone.first_name} ${zone.last_name}`,
          sender_department: 'Zone Admin', 
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

// ✅ ADD THIS MISSING FUNCTION
export const markReportAsRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { 
        id: req.params.id, 
        recipient_id: req.user.id, 
        recipient_type: 'zone' 
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

// ==================== NOTIFICATION MANAGEMENT ====================

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'zone' };
    if (unreadOnly === 'true') whereClause.is_read = false;
    
    const totalCount = await Notification.count({ where: whereClause });
    const notifications = await Notification.findAll({
      where: whereClause, 
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), 
      offset: parseInt(offset)
    });
    
    const unreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'zone', is_read: false } });
    const urgentUnreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'zone', is_read: false, priority: 'urgent' } });
    
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
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'zone' }
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
      where: { recipient_id: req.user.id, recipient_type: 'zone', is_read: false }
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
    const inboxCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'zone' } });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'zone', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'zone', is_opened: false, priority: 'urgent' } });
    const outboxCount = await Report.count({ where: { sender_id: req.user.id, sender_type: 'zone' } });
    const woredaCount = await WoredaAdmin.count({ where: { zone_id: req.user.id, status: 'active' } });
    
    res.json({ 
      success: true, 
      stats: { 
        inbox: inboxCount, 
        unread: unreadCount,
        urgentUnread: urgentUnreadCount,
        outbox: outboxCount, 
        totalWoredas: woredaCount,
        drafts: 0,
        closed: 0
      } 
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};