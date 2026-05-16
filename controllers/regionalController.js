import RegionalAdmin from "../models/RegionalAdmin.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import WoredaAdmin from "../models/WoredaAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import FederalAdmin from "../models/FederalAdmin.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import { uploadToB2 } from "../Services/b2Upload.js";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import sequelize from "../config/database.js";

// ==================== PROFILE MANAGEMENT ====================

export const getProfile = async (req, res) => {
  try {
    const regional = await RegionalAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!regional) {
      return res.status(404).json({ success: false, message: "Regional admin not found" });
    }
    
    res.json({ success: true, regional });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, phone, gender, age } = req.body;
    
    const regional = await RegionalAdmin.findByPk(req.user.id);
    
    if (!regional) {
      return res.status(404).json({ success: false, message: "Regional admin not found" });
    }
    
    await regional.update({
      first_name: first_name || regional.first_name,
      middle_name: middle_name !== undefined ? middle_name : regional.middle_name,
      last_name: last_name || regional.last_name,
      phone: phone !== undefined ? phone : regional.phone,
      gender: gender || regional.gender,
      age: age || regional.age
    });
    
    const updatedRegional = await RegionalAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ success: true, regional: updatedRegional, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const regional = await RegionalAdmin.findByPk(req.user.id);
    
    if (!regional) {
      return res.status(404).json({ success: false, message: "Regional admin not found" });
    }
    
    const isMatch = await bcrypt.compare(current_password, regional.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await regional.update({ password: hashedPassword });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FEDERAL INFO ====================

export const getFederalInfo = async (req, res) => {
  try {
    const federalAdmin = await FederalAdmin.findOne({
      attributes: { exclude: ['password'] }
    });
    
    if (!federalAdmin) {
      return res.json({ success: false, message: "No federal admin found", federal: null });
    }
    
    const federalData = {
      id: federalAdmin.id,
      first_name: federalAdmin.first_name,
      last_name: federalAdmin.last_name,
      full_name: `${federalAdmin.first_name || ''} ${federalAdmin.last_name || ''}`.trim(),
      email: federalAdmin.email,
      phone: federalAdmin.phone
    };
    
    res.json({ success: true, federal: federalData });
  } catch (error) {
    console.error("Error in getFederalInfo:", error);
    res.status(500).json({ success: false, message: error.message, federal: null });
  }
};

// ==================== ZONE ADMIN MANAGEMENT ====================

export const getZonesForReport = async (req, res) => {
  try {
    const zones = await ZoneAdmin.findAll({
      where: { regional_id: req.user.id, status: 'active' },
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'zone_name', 'status']
    });
    
    const formattedZones = zones.map(z => ({
      id: z.id,
      first_name: z.first_name,
      last_name: z.last_name,
      full_name: `${z.first_name} ${z.last_name}`.trim(),
      email: z.email,
      phone: z.phone,
      zone_name: z.zone_name,
      status: z.status,
      type: 'zone'
    }));
    
    res.json({ success: true, zones: formattedZones, count: formattedZones.length });
  } catch (error) {
    console.error("Error in getZonesForReport:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getZones = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', showInactive = false } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { regional_id: req.user.id };
    
    if (!showInactive) {
      whereClause.status = 'active';
    }
    
    if (search) {
      whereClause[Op.or] = [
        { zone_name: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const totalCount = await ZoneAdmin.count({ where: whereClause });
    
    const zones = await ZoneAdmin.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const formattedZones = zones.map(zone => ({
      id: zone.id,
      zone_name: zone.zone_name,
      name: zone.zone_name,
      first_name: zone.first_name,
      last_name: zone.last_name,
      admin_name: `${zone.first_name} ${zone.last_name}`,
      email: zone.email,
      phone: zone.phone,
      gender: zone.gender,
      age: zone.age,
      status: zone.status
    }));
    
    res.json({ success: true, zones: formattedZones, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page), totalCount });
  } catch (error) {
    console.error("Get zones error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createZoneAdmin = async (req, res) => {
  try {
    const { zone_name, first_name, middle_name, last_name, gender, age, email, password, phone } = req.body;
    
    const existingAdmin = await ZoneAdmin.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    
    const zoneAdmin = await ZoneAdmin.create({
      regional_id: req.user.id,
      zone_name,
      first_name,
      middle_name,
      last_name,
      gender,
      age,
      email,
      password,
      phone,
      role: "Zone_Admin",
      status: "active"
    });
    
    const created = await ZoneAdmin.findByPk(zoneAdmin.id, { attributes: { exclude: ['password'] } });
    
    const formattedZone = {
      id: created.id,
      zone_name: created.zone_name,
      name: created.zone_name,
      first_name: created.first_name,
      last_name: created.last_name,
      admin_name: `${created.first_name} ${created.last_name}`,
      email: created.email,
      phone: created.phone,
      gender: created.gender,
      age: created.age,
      status: created.status
    };
    
    res.status(201).json({ success: true, zoneAdmin: formattedZone, message: "Zone admin created successfully" });
  } catch (error) {
    console.error("Create zone admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateZoneAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { zone_name, first_name, middle_name, last_name, gender, age, phone, status } = req.body;
    
    const zoneAdmin = await ZoneAdmin.findOne({ where: { id, regional_id: req.user.id } });
    if (!zoneAdmin) {
      return res.status(404).json({ success: false, message: "Zone admin not found" });
    }
    
    await zoneAdmin.update({
      zone_name: zone_name || zoneAdmin.zone_name,
      first_name: first_name || zoneAdmin.first_name,
      middle_name: middle_name !== undefined ? middle_name : zoneAdmin.middle_name,
      last_name: last_name || zoneAdmin.last_name,
      gender: gender || zoneAdmin.gender,
      age: age || zoneAdmin.age,
      phone: phone !== undefined ? phone : zoneAdmin.phone,
      status: status || zoneAdmin.status
    });
    
    const updated = await ZoneAdmin.findByPk(id, { attributes: { exclude: ['password'] } });
    
    const formattedZone = {
      id: updated.id,
      zone_name: updated.zone_name,
      name: updated.zone_name,
      first_name: updated.first_name,
      last_name: updated.last_name,
      admin_name: `${updated.first_name} ${updated.last_name}`,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      age: updated.age,
      status: updated.status
    };
    
    res.json({ success: true, zoneAdmin: formattedZone, message: "Zone admin updated successfully" });
  } catch (error) {
    console.error("Update zone admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteZoneAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const zoneAdmin = await ZoneAdmin.findOne({ where: { id, regional_id: req.user.id } });
    if (!zoneAdmin) {
      return res.status(404).json({ success: false, message: "Zone admin not found" });
    }
    
    await zoneAdmin.update({ status: 'inactive' });
    res.json({ success: true, message: "Zone admin deactivated successfully" });
  } catch (error) {
    console.error("Delete zone admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ZONE WOREDA VIEW ====================

export const getZoneWoredas = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await ZoneAdmin.findOne({ where: { id: zoneId, regional_id: req.user.id } });
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found or not under your region" });
    }
    
    const woredas = await WoredaAdmin.findAll({
      where: { zone_id: zoneId, status: 'active' },
      attributes: ['id', 'woreda_name', 'first_name', 'last_name', 'email', 'phone', 'status']
    });
    
    const formattedWoredas = woredas.map(w => ({
      id: w.id,
      woreda_name: w.woreda_name,
      admin_name: `${w.first_name} ${w.last_name}`.trim(),
      email: w.email,
      phone: w.phone,
      status: w.status
    }));
    
    res.json({ success: true, woredas: formattedWoredas, total: formattedWoredas.length, zone_name: zone.zone_name });
  } catch (error) {
    console.error("Get zone woredas error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== WOREDA KEBELE VIEW ====================

export const getWoredaKebeles = async (req, res) => {
  try {
    const { woredaId } = req.params;
    
    const woreda = await WoredaAdmin.findOne({ where: { id: woredaId } });
    if (!woreda) {
      return res.status(404).json({ success: false, message: "Woreda not found" });
    }
    
    const kebeles = await KebeleAdmin.findAll({
      where: { woreda_id: woredaId, status: 'active' },
      attributes: ['id', 'kebele_name', 'first_name', 'last_name', 'email', 'phone', 'status']
    });
    
    const formattedKebeles = kebeles.map(k => ({
      id: k.id,
      kebele_name: k.kebele_name,
      admin_name: `${k.first_name} ${k.last_name}`.trim(),
      email: k.email,
      phone: k.phone,
      status: k.status
    }));
    
    res.json({ success: true, kebeles: formattedKebeles, total: formattedKebeles.length, woreda_name: woreda.woreda_name });
  } catch (error) {
    console.error("Get woreda kebeles error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT ====================

export const sendReport = async (req, res) => {
  try {
    console.log("📝 Sending report from Regional...");
    console.log("   Files received:", req.files?.length || 0);
    
    const { title, body, priority, recipient_type, recipient_id } = req.body;
    
    const sender = await RegionalAdmin.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientFederalId = null;
    let recipientZoneId = null;
    
    if (recipient_type === 'federal') {
      recipient = await FederalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientFederalId = recipient.id;
      }
    } else if (recipient_type === 'zone') {
      recipient = await ZoneAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientZoneId = recipient.id;
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
      report_number, title, subject: title, body, priority: priority || 'medium', status: 'sent', attachments: attachments,
      sender_id: sender.id, sender_type: 'regional',
      sender_first_name: sender.first_name, sender_middle_name: sender.middle_name, sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Regional Admin - ${sender.region_name}`,
      sender_region: sender.region_name, sender_region_id: sender.id,
      recipient_id: recipient.id, recipient_type: recipient_type === 'federal' ? 'federal' : 'zone',
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_federal: recipient_type === 'federal' ? 'Federal' : '',
      recipient_federal_id: recipientFederalId,
      recipient_zone: recipient_type === 'zone' ? recipient.zone_name : '',
      recipient_zone_id: recipientZoneId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    
    console.log(`✅ Report created with ID: ${report.id}, Attachments: ${attachments.length}`);
    
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (recipient_type === 'federal') {
        recipientRoom = `federal_${recipientFederalId}`;
      } else if (recipient_type === 'zone') {
        recipientRoom = `zone_${recipientZoneId}`;
      }
      if (recipientRoom) {
        io.to(recipientRoom).emit('new_report_from_regional', {
          report_id: report.id, report_number: report.report_number, title: report.title,
          priority: report.priority, sender_name: `${sender.first_name} ${sender.last_name}`,
          sender_region: sender.region_name, sent_at: report.sent_at,
          body_preview: body?.substring(0, 100), body: body, has_attachments: attachments.length > 0
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
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'regional' };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { sender_full_name: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    const reports = await Report.findAll({ where: whereClause, order: [['sent_at', 'DESC']], limit: parseInt(limit), offset: parseInt(offset) });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'regional', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'regional', is_opened: false, priority: 'urgent' } });
    
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
    
    const whereClause = { sender_id: req.user.id, sender_type: 'regional' };
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
          { sender_id: req.user.id, sender_type: 'regional' },
          { recipient_id: req.user.id, recipient_type: 'regional' }
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
      where: { recipient_id: req.user.id, recipient_type: 'regional', thread_id: threadId, is_opened: false }
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
        sender_type: msg.sender_type, sender_department: msg.sender_department || (msg.sender_type === 'zone' ? 'Zone Admin' : msg.sender_type === 'federal' ? 'Federal Admin' : 'Regional Admin'),
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
      where: { id: req.params.id, [Op.or]: [{ sender_id: req.user.id, sender_type: 'regional' }, { recipient_id: req.user.id, recipient_type: 'regional' }] }
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
    const regional = req.user;
    
    console.log(`📝 Replying to report ${id}, Files: ${req.files?.length || 0}`);
    if (!body && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: 'Reply message or attachment is required' });
    }
    
    const parentReport = await Report.findByPk(id);
    if (!parentReport) { return res.status(404).json({ success: false, message: 'Report not found' }); }
    
    let recipient = null, recipientFullName = '', recipientFederalId = null, recipientZoneId = null;
    
    if (parentReport.sender_type === 'federal') {
      recipient = await FederalAdmin.findByPk(parentReport.sender_id);
      if (recipient) { recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim(); recipientFederalId = recipient.id; }
    } else if (parentReport.sender_type === 'zone') {
      recipient = await ZoneAdmin.findByPk(parentReport.sender_id);
      if (recipient) { recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim(); recipientZoneId = recipient.id; }
    }
    
    if (!recipient) { return res.status(404).json({ success: false, message: 'Recipient not found' }); }
    
    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToB2(file, regional.id);
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
      sender_id: regional.id, sender_type: 'regional',
      sender_first_name: regional.first_name, sender_middle_name: regional.middle_name, sender_last_name: regional.last_name,
      sender_full_name: `${regional.first_name || ''} ${regional.middle_name || ''} ${regional.last_name || ''}`.trim(),
      sender_title: `Regional Admin - ${regional.region_name}`, sender_region: regional.region_name, sender_region_id: regional.id,
      recipient_id: recipient.id, recipient_type: parentReport.sender_type,
      recipient_first_name: recipient.first_name, recipient_middle_name: recipient.middle_name, recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_federal: parentReport.sender_type === 'federal' ? 'Federal' : '',
      recipient_federal_id: recipientFederalId,
      recipient_zone: parentReport.sender_type === 'zone' ? recipient.zone_name : '',
      recipient_zone_id: recipientZoneId,
      parent_report_id: parentReport.id, thread_id: threadId,
      sent_at: new Date(), last_activity_at: new Date()
    });
    
    await parentReport.update({ status: 'replied', last_activity_at: new Date(), reply_count: (parentReport.reply_count || 0) + 1 });
    
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'federal') { recipientRoom = `federal_${recipient.id}`; }
      else if (parentReport.sender_type === 'zone') { recipientRoom = `zone_${recipient.id}`; }
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_regional', {
          report_id: reply.id, parent_report_id: parentReport.id, report_number: reply.report_number,
          title: reply.title, priority: reply.priority, sender_name: `${regional.first_name} ${regional.last_name}`,
          sender_department: 'Regional Admin', sent_at: reply.sent_at, body_preview: (body || '').substring(0, 100),
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
    const report = await Report.findOne({ where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'regional' } });
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
    const whereClause = { recipient_id: req.user.id, recipient_type: 'regional' };
    if (unreadOnly === 'true') whereClause.is_read = false;
    const totalCount = await Notification.count({ where: whereClause });
    const notifications = await Notification.findAll({ where: whereClause, order: [['createdAt', 'DESC']], limit: parseInt(limit), offset: parseInt(offset) });
    const unreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'regional', is_read: false } });
    const urgentUnreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'regional', is_read: false, priority: 'urgent' } });
    res.json({ success: true, notifications, unreadCount, urgentUnreadCount, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: parseInt(page) });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'regional' } });
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
    await Notification.update({ is_read: true, read_at: new Date() }, { where: { recipient_id: req.user.id, recipient_type: 'regional', is_read: false } });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DASHBOARD STATS ====================

export const getDashboardStats = async (req, res) => {
  try {
    const inboxCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'regional' } });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'regional', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'regional', is_opened: false, priority: 'urgent' } });
    const outboxCount = await Report.count({ where: { sender_id: req.user.id, sender_type: 'regional' } });
    const zoneCount = await ZoneAdmin.count({ where: { regional_id: req.user.id, status: 'active' } });
    
    res.json({ success: true, stats: { inbox: inboxCount, unread: unreadCount, urgentUnread: urgentUnreadCount, outbox: outboxCount, totalZones: zoneCount, drafts: 0, closed: 0 } });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};