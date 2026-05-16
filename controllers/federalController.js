import FederalAdmin from "../models/FederalAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import { uploadToB2 } from "../Services/b2Upload.js";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import sequelize from "../config/database.js";

// ==================== PROFILE MANAGEMENT ====================

export const getProfile = async (req, res) => {
  try {
    const federal = await FederalAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!federal) {
      return res.status(404).json({ success: false, message: "Federal admin not found" });
    }
    res.json({ success: true, federal });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, phone, gender, age } = req.body;
    const federal = await FederalAdmin.findByPk(req.user.id);
    if (!federal) {
      return res.status(404).json({ success: false, message: "Federal admin not found" });
    }
    await federal.update({
      first_name: first_name || federal.first_name,
      middle_name: middle_name !== undefined ? middle_name : federal.middle_name,
      last_name: last_name || federal.last_name,
      phone: phone !== undefined ? phone : federal.phone,
      gender: gender || federal.gender,
      age: age || federal.age
    });
    const updatedFederal = await FederalAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, federal: updatedFederal, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const federal = await FederalAdmin.findByPk(req.user.id);
    if (!federal) {
      return res.status(404).json({ success: false, message: "Federal admin not found" });
    }
    const isMatch = await bcrypt.compare(current_password, federal.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await federal.update({ password: hashedPassword });
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REGIONS LIST (FOR DROPDOWN) ====================

export const getRegionsList = async (req, res) => {
  try {
    const regions = await RegionalAdmin.findAll({
      where: { status: 'active' },
      attributes: ['id', 'region_name', 'first_name', 'last_name', 'email']
    });
    const formattedRegions = regions.map(region => ({
      id: region.id,
      region_name: region.region_name,
      full_name: `${region.first_name} ${region.last_name}`.trim(),
      email: region.email
    }));
    res.json({ success: true, regions: formattedRegions });
  } catch (error) {
    console.error("Get regions list error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REGIONAL ADMIN MANAGEMENT ====================

export const getRegions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', showInactive = false } = req.query;
    const offset = (page - 1) * limit;
    const whereClause = {};
    if (!showInactive) whereClause.status = 'active';
    if (search) {
      whereClause[Op.or] = [
        { region_name: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    const totalCount = await RegionalAdmin.count({ where: whereClause });
    const regions = await RegionalAdmin.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    const formattedRegions = regions.map(region => ({
      id: region.id,
      region_name: region.region_name,
      name: region.region_name,
      first_name: region.first_name,
      last_name: region.last_name,
      admin_name: `${region.first_name} ${region.last_name}`,
      email: region.email,
      phone: region.phone,
      gender: region.gender,
      age: region.age,
      status: region.status
    }));
    res.json({ success: true, regions: formattedRegions, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page), totalCount });
  } catch (error) {
    console.error("Get regions error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRegionalAdmin = async (req, res) => {
  try {
    const { region_name, first_name, middle_name, last_name, gender, age, email, password, phone } = req.body;
    
    const existingAdmin = await RegionalAdmin.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    
    // Get the federal admin ID from the authenticated user
    const federal_id = req.user.id;
    
    const regionalAdmin = await RegionalAdmin.create({
      region_name, 
      first_name, 
      middle_name, 
      last_name, 
      gender, 
      age, 
      email, 
      password, 
      phone,
      federal_id,  // ← Added: Link to the federal admin
      role: "Regional_Admin", 
      status: "active"
    });
    
    const created = await RegionalAdmin.findByPk(regionalAdmin.id, { attributes: { exclude: ['password'] } });
    
    const formattedRegion = {
      id: created.id, 
      region_name: created.region_name, 
      name: created.region_name,
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
      regionalAdmin: formattedRegion, 
      message: "Regional admin created successfully" 
    });
  } catch (error) {
    console.error("Create regional admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateRegionalAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { region_name, first_name, middle_name, last_name, gender, age, phone, status } = req.body;
    const regionalAdmin = await RegionalAdmin.findByPk(id);
    if (!regionalAdmin) {
      return res.status(404).json({ success: false, message: "Regional admin not found" });
    }
    await regionalAdmin.update({
      region_name: region_name || regionalAdmin.region_name,
      first_name: first_name || regionalAdmin.first_name,
      middle_name: middle_name !== undefined ? middle_name : regionalAdmin.middle_name,
      last_name: last_name || regionalAdmin.last_name,
      gender: gender || regionalAdmin.gender,
      age: age || regionalAdmin.age,
      phone: phone !== undefined ? phone : regionalAdmin.phone,
      status: status || regionalAdmin.status
    });
    const updated = await RegionalAdmin.findByPk(id, { attributes: { exclude: ['password'] } });
    const formattedRegion = {
      id: updated.id, region_name: updated.region_name, name: updated.region_name,
      first_name: updated.first_name, last_name: updated.last_name,
      admin_name: `${updated.first_name} ${updated.last_name}`,
      email: updated.email, phone: updated.phone, gender: updated.gender,
      age: updated.age, status: updated.status
    };
    res.json({ success: true, regionalAdmin: formattedRegion, message: "Regional admin updated successfully" });
  } catch (error) {
    console.error("Update regional admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRegionalAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const regionalAdmin = await RegionalAdmin.findByPk(id);
    if (!regionalAdmin) {
      return res.status(404).json({ success: false, message: "Regional admin not found" });
    }
    await regionalAdmin.update({ status: 'inactive' });
    res.json({ success: true, message: "Regional admin deactivated successfully" });
  } catch (error) {
    console.error("Delete regional admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REGION ZONES VIEW ====================

export const getRegionZones = async (req, res) => {
  try {
    const { regionId } = req.params;
    const region = await RegionalAdmin.findByPk(regionId);
    if (!region) {
      return res.status(404).json({ success: false, message: "Region not found" });
    }
    const zones = await ZoneAdmin.findAll({
      where: { regional_id: regionId, status: 'active' },
      attributes: ['id', 'zone_name', 'first_name', 'last_name', 'email', 'phone', 'status']
    });
    const formattedZones = zones.map(zone => ({
      id: zone.id, zone_name: zone.zone_name,
      admin_name: `${zone.first_name} ${zone.last_name}`.trim(),
      email: zone.email, phone: zone.phone, status: zone.status
    }));
    res.json({ success: true, zones: formattedZones, total: formattedZones.length, region_name: region.region_name });
  } catch (error) {
    console.error("Get region zones error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT ====================

export const sendReport = async (req, res) => {
  try {
    console.log("📝 Sending report from Federal...");
    console.log("   Files received:", req.files?.length || 0);
    const { title, body, priority, recipient_type, recipient_id } = req.body;
    const sender = await FederalAdmin.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }
    let recipient = null, recipientFullName = '', recipientRegionalId = null;
    if (recipient_type === 'regional') {
      recipient = await RegionalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientRegionalId = recipient.id;
      }
    }
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const report_number = `RPT-${timestamp}-${randomString}`;
    console.log(`📋 Generated unique report number: ${report_number}`);
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachments...`);
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToB2(file, sender.id);
          attachments.push({
            filename: uploadResult.originalName, originalName: uploadResult.originalName,
            mimeType: uploadResult.mimeType, size: uploadResult.size,
            url: uploadResult.url, key: uploadResult.key, expiresAt: uploadResult.expiresAt
          });
          console.log(`   ✅ Uploaded: ${uploadResult.originalName} -> Key: ${uploadResult.key}`);
        } catch (uploadError) {
          console.error(`   ❌ Failed to upload: ${file.originalname}`, uploadError.message);
        }
      }
    }
    const report = await Report.create({
      report_number, title, subject: title, body, priority: priority || 'medium', status: 'sent', attachments: attachments,
      sender_id: sender.id, sender_type: 'federal',
      sender_first_name: sender.first_name, sender_middle_name: sender.middle_name, sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Federal Admin`,
      recipient_id: recipient.id, recipient_type: 'regional',
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName, recipient_region: recipient.region_name, recipient_region_id: recipientRegionalId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    console.log(`✅ Report created with ID: ${report.id}, Attachments: ${attachments.length}`);
    const io = req.app.get('io');
    if (io) {
      const recipientRoom = `regional_${recipientRegionalId}`;
      if (recipientRoom) {
        io.to(recipientRoom).emit('new_report_from_federal', {
          report_id: report.id, report_number: report.report_number, title: report.title,
          priority: report.priority, sender_name: `${sender.first_name} ${sender.last_name}`,
          sent_at: report.sent_at, body_preview: body?.substring(0, 100), body: body,
          has_attachments: attachments.length > 0
        });
      }
    }
    res.status(201).json({ success: true, report: { id: report.id, report_number: report.report_number, title: report.title, priority: report.priority, attachments_count: attachments.length, attachments: attachments }, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    const whereClause = { recipient_id: req.user.id, recipient_type: 'federal' };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { sender_full_name: { [Op.like]: `%${search}%` } }
      ];
    }
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({ where: whereClause, order: [['sent_at', 'DESC']], limit: parseInt(limit), offset: parseInt(offset) });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'federal', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'federal', is_opened: false, priority: 'urgent' } });
    res.json({ success: true, reports: reports.map(r => ({ ...r.toJSON(), attachments_count: r.attachments?.length || 0 })), totalCount, unreadCount, urgentUnreadCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    const whereClause = { sender_id: req.user.id, sender_type: 'federal' };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { recipient_full_name: { [Op.like]: `%${search}%` } }
      ];
    }
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({ where: whereClause, order: [['sent_at', 'DESC']], limit: parseInt(limit), offset: parseInt(offset) });
    res.json({ success: true, reports: reports.map(r => ({ ...r.toJSON(), display_recipient: r.recipient_full_name, attachments_count: r.attachments?.length || 0 })), totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversationThread = async (req, res) => {
  try {
    const { reportId } = req.params;
    const parentReport = await Report.findOne({
      where: {
        id: reportId,
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'federal' },
          { recipient_id: req.user.id, recipient_type: 'federal' }
        ]
      }
    });
    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    const threadId = parentReport.thread_id || parentReport.id;
    const allMessages = await Report.findAll({
      where: { [Op.or]: [{ id: threadId }, { thread_id: threadId }, { parent_report_id: threadId }] },
      order: [['sent_at', 'ASC']]
    });
    await Report.update({ is_opened: true, opened_at: new Date(), opened_count: sequelize.literal('opened_count + 1') }, {
      where: { recipient_id: req.user.id, recipient_type: 'federal', thread_id: threadId, is_opened: false }
    });
    const formattedMessages = allMessages.map(msg => {
      let attachments = [];
      if (msg.attachments) {
        if (typeof msg.attachments === 'string') {
          try { attachments = JSON.parse(msg.attachments); } catch(e) { attachments = []; }
        } else if (Array.isArray(msg.attachments)) { attachments = msg.attachments; }
        else if (typeof msg.attachments === 'object') { attachments = [msg.attachments]; }
      }
      const formattedAttachments = attachments.map(att => ({
        filename: att.filename || att.key?.split('/').pop() || 'file',
        originalName: att.originalName || att.filename || 'Unknown',
        mimeType: att.mimeType || att.mimetype || 'application/octet-stream',
        size: att.size || 0, url: att.url || null, key: att.key || att.filename, expiresAt: att.expiresAt || null
      }));
      return {
        id: msg.id, report_number: msg.report_number, title: msg.title, body: msg.body,
        priority: msg.priority, attachments: formattedAttachments, sender_name: msg.sender_full_name,
        sender_type: msg.sender_type, sender_department: msg.sender_department || (msg.sender_type === 'regional' ? 'Regional Admin' : 'Federal Admin'),
        sent_at: msg.sent_at, is_reply: !!msg.parent_report_id, parent_id: msg.parent_report_id
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
      where: { id: req.params.id, [Op.or]: [{ sender_id: req.user.id, sender_type: 'federal' }, { recipient_id: req.user.id, recipient_type: 'federal' }] }
    });
    if (!report) { return res.status(404).json({ success: false, message: "Report not found" }); }
    if (report.recipient_id === req.user.id && !report.is_opened) {
      await report.update({ is_opened: true, opened_at: new Date(), opened_count: (report.opened_count || 0) + 1 });
    }
    let attachments = report.attachments || [];
    if (typeof attachments === 'string') { try { attachments = JSON.parse(attachments); } catch(e) { attachments = []; } }
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
    const federal = req.user;
    console.log(`📝 Replying to report ${id}, Files: ${req.files?.length || 0}`);
    if (!body && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: 'Reply message or attachment is required' });
    }
    const parentReport = await Report.findByPk(id);
    if (!parentReport) { return res.status(404).json({ success: false, message: 'Report not found' }); }
    let recipient = null, recipientFullName = '', recipientRegionalId = null;
    if (parentReport.sender_type === 'regional') {
      recipient = await RegionalAdmin.findByPk(parentReport.sender_id);
      if (recipient) { recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim(); recipientRegionalId = recipient.id; }
    }
    if (!recipient) { return res.status(404).json({ success: false, message: 'Recipient not found' }); }
    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToB2(file, federal.id);
          attachments.push({ filename: uploadResult.originalName, originalName: uploadResult.originalName, mimeType: uploadResult.mimeType, size: uploadResult.size, url: uploadResult.url, key: uploadResult.key, expiresAt: uploadResult.expiresAt });
          console.log(`   ✅ Uploaded: ${uploadResult.originalName} -> Key: ${uploadResult.key}`);
        } catch (uploadError) { console.error(`   ❌ Failed to upload: ${file.originalname}`, uploadError.message); }
      }
    }
    const report_number = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const threadId = parentReport.thread_id || parentReport.id;
    const reply = await Report.create({
      report_number, title: `Re: ${parentReport.title}`, subject: parentReport.subject, body: body || '',
      priority: parentReport.priority, status: 'sent', attachments: attachments,
      sender_id: federal.id, sender_type: 'federal',
      sender_first_name: federal.first_name, sender_middle_name: federal.middle_name, sender_last_name: federal.last_name,
      sender_full_name: `${federal.first_name || ''} ${federal.middle_name || ''} ${federal.last_name || ''}`.trim(),
      sender_title: `Federal Admin`,
      recipient_id: recipient.id, recipient_type: 'regional',
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName, recipient_region: recipient.region_name, recipient_region_id: recipientRegionalId,
      parent_report_id: parentReport.id, thread_id: threadId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    await parentReport.update({ status: 'replied', last_activity_at: new Date(), reply_count: (parentReport.reply_count || 0) + 1 });
    const io = req.app.get('io');
    if (io) {
      const recipientRoom = `regional_${recipient.id}`;
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_federal', {
          report_id: reply.id, parent_report_id: parentReport.id, report_number: reply.report_number,
          title: reply.title, priority: reply.priority, sender_name: `${federal.first_name} ${federal.last_name}`,
          sender_department: 'Federal Admin', sent_at: reply.sent_at, body_preview: (body || '').substring(0, 100),
          is_reply: true, has_attachments: attachments.length > 0
        });
      }
    }
    res.json({ success: true, reply: { id: reply.id, title: reply.title, body: reply.body, attachments: attachments, sent_at: reply.sent_at }, message: "Reply sent successfully" });
  } catch (error) {
    console.error('Reply to report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markReportAsRead = async (req, res) => {
  try {
    const report = await Report.findOne({ where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'federal' } });
    if (!report) { return res.status(404).json({ success: false, message: "Report not found" }); }
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
    const whereClause = { recipient_id: req.user.id, recipient_type: 'federal' };
    if (unreadOnly === 'true') whereClause.is_read = false;
    const totalCount = await Notification.count({ where: whereClause });
    const notifications = await Notification.findAll({ where: whereClause, order: [['createdAt', 'DESC']], limit: parseInt(limit), offset: parseInt(offset) });
    const unreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'federal', is_read: false } });
    const urgentUnreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'federal', is_read: false, priority: 'urgent' } });
    res.json({ success: true, notifications, unreadCount, urgentUnreadCount, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'federal' } });
    if (!notification) { return res.status(404).json({ success: false, message: "Notification not found" }); }
    await notification.update({ is_read: true, read_at: new Date() });
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.update({ is_read: true, read_at: new Date() }, { where: { recipient_id: req.user.id, recipient_type: 'federal', is_read: false } });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DASHBOARD STATS ====================

export const getDashboardStats = async (req, res) => {
  try {
    const inboxCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'federal' } });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'federal', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'federal', is_opened: false, priority: 'urgent' } });
    const outboxCount = await Report.count({ where: { sender_id: req.user.id, sender_type: 'federal' } });
    const regionCount = await RegionalAdmin.count({ where: { status: 'active' } });
    res.json({ success: true, stats: { inbox: inboxCount, unread: unreadCount, urgentUnread: urgentUnreadCount, outbox: outboxCount, totalRegions: regionCount, drafts: 0, closed: 0 } });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};