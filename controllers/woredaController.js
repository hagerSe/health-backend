import WoredaAdmin from "../models/WoredaAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import HospitalStaff from "../models/HospitalStaff.js";
import Report from "../models/Report.js";
import { uploadToB2 } from "../Services/b2Upload.js";
import Notification from "../models/Notification.js";
import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";

// ==================== PROFILE MANAGEMENT ====================

export const getProfile = async (req, res) => {
  try {
    const woreda = await WoredaAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: ZoneAdmin,
        as: 'zone_admin',
        attributes: ['id', 'zone_name', 'first_name', 'last_name']
      }]
    });
    
    if (!woreda) {
      return res.status(404).json({ 
        success: false, 
        message: "Woreda admin not found" 
      });
    }
    
    res.json({ 
      success: true, 
      woreda 
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, phone, gender, age } = req.body;
    
    const woreda = await WoredaAdmin.findByPk(req.user.id);
    
    if (!woreda) {
      return res.status(404).json({ 
        success: false, 
        message: "Woreda admin not found" 
      });
    }
    
    await woreda.update({
      first_name: first_name || woreda.first_name,
      middle_name: middle_name !== undefined ? middle_name : woreda.middle_name,
      last_name: last_name || woreda.last_name,
      phone: phone !== undefined ? phone : woreda.phone,
      gender: gender || woreda.gender,
      age: age || woreda.age
    });
    
    const updatedWoreda = await WoredaAdmin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      woreda: updatedWoreda,
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
    
    const woreda = await WoredaAdmin.findByPk(req.user.id);
    
    if (!woreda) {
      return res.status(404).json({ 
        success: false, 
        message: "Woreda admin not found" 
      });
    }
    
    const isMatch = await bcrypt.compare(current_password, woreda.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await woreda.update({ password: hashedPassword });
    
    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ZONE INFO ====================

export const getZoneInfo = async (req, res) => {
  try {
    const woredaAdmin = await WoredaAdmin.findByPk(req.user.id);
    
    if (!woredaAdmin) {
      return res.status(404).json({ success: false, message: "Woreda admin not found" });
    }
    
    if (!woredaAdmin.zone_id) {
      return res.json({ success: true, zone: null });
    }
    
    const zoneAdmin = await ZoneAdmin.findByPk(woredaAdmin.zone_id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!zoneAdmin) {
      return res.json({ success: true, zone: null });
    }
    
    const zoneData = {
      id: zoneAdmin.id,
      first_name: zoneAdmin.first_name,
      last_name: zoneAdmin.last_name,
      full_name: `${zoneAdmin.first_name || ''} ${zoneAdmin.last_name || ''}`.trim(),
      email: zoneAdmin.email,
      phone: zoneAdmin.phone,
      zone_name: zoneAdmin.zone_name
    };
    
    res.json({ success: true, zone: zoneData });
  } catch (error) {
    console.error("Get zone info error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== KEBELE ADMIN MANAGEMENT ====================

export const getKebelesForReport = async (req, res) => {
  try {
    const kebeles = await KebeleAdmin.findAll({
      where: { woreda_id: req.user.id, status: 'active' },
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'kebele_name']
    });
    
    const formattedKebeles = kebeles.map(k => ({
      id: k.id,
      first_name: k.first_name,
      last_name: k.last_name,
      full_name: `${k.first_name} ${k.last_name}`.trim(),
      email: k.email,
      phone: k.phone,
      kebele_name: k.kebele_name,
      type: 'kebele'
    }));
    
    res.json({ success: true, kebeles: formattedKebeles });
  } catch (error) {
    console.error("Get kebeles for report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getKebeles = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', showInactive = false } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { woreda_id: req.user.id };
    
    if (!showInactive) {
      whereClause.status = 'active';
    }
    
    if (search) {
      whereClause[Op.or] = [
        { kebele_name: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const totalCount = await KebeleAdmin.count({ where: whereClause });
    
    const kebeles = await KebeleAdmin.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // Get hospital counts for each kebele
    const formattedKebeles = await Promise.all(kebeles.map(async (kebele) => {
      const hospitalCount = await HospitalAdmin.count({
        where: { kebele_id: kebele.id, status: 'active' }
      });
      
      return {
        id: kebele.id,
        kebele_name: kebele.kebele_name,
        name: kebele.kebele_name,
        first_name: kebele.first_name,
        last_name: kebele.last_name,
        admin_name: `${kebele.first_name} ${kebele.last_name}`,
        email: kebele.email,
        phone: kebele.phone,
        gender: kebele.gender,
        age: kebele.age,
        status: kebele.status || 'active',
        created_at: kebele.createdAt,
        hospital_count: hospitalCount,
        code: `KEB-${String(kebele.id).padStart(4, '0')}`
      };
    }));
    
    res.json({ 
      success: true, 
      kebeles: formattedKebeles,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      totalCount
    });
  } catch (error) {
    console.error("Get kebeles error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createKebeleAdmin = async (req, res) => {
  try {
    const { 
      kebele_name, first_name, middle_name, last_name, 
      gender, age, email, password, phone 
    } = req.body;
    
    const existingAdmin = await KebeleAdmin.findOne({ where: { email } });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Email already registered" 
      });
    }
    
    const kebeleAdmin = await KebeleAdmin.create({
      woreda_id: req.user.id,
      kebele_name,
      first_name,
      middle_name,
      last_name,
      gender,
      age,
      email,
      password,
      phone,
      role: "Kebele_Admin",
      status: "active"
    });
    
    const created = await KebeleAdmin.findByPk(kebeleAdmin.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.status(201).json({ 
      success: true, 
      kebeleAdmin: created,
      message: "Kebele admin created successfully" 
    });
  } catch (error) {
    console.error("Create kebele admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateKebeleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { kebele_name, first_name, middle_name, last_name, gender, age, phone, status } = req.body;
    
    const kebeleAdmin = await KebeleAdmin.findOne({
      where: { id, woreda_id: req.user.id }
    });
    
    if (!kebeleAdmin) {
      return res.status(404).json({ success: false, message: "Kebele admin not found" });
    }
    
    await kebeleAdmin.update({
      kebele_name: kebele_name || kebeleAdmin.kebele_name,
      first_name: first_name || kebeleAdmin.first_name,
      middle_name: middle_name !== undefined ? middle_name : kebeleAdmin.middle_name,
      last_name: last_name || kebeleAdmin.last_name,
      gender: gender || kebeleAdmin.gender,
      age: age || kebeleAdmin.age,
      phone: phone !== undefined ? phone : kebeleAdmin.phone,
      status: status || kebeleAdmin.status
    });
    
    const updated = await KebeleAdmin.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      kebeleAdmin: updated,
      message: "Kebele admin updated successfully" 
    });
  } catch (error) {
    console.error("Update kebele admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteKebeleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const kebeleAdmin = await KebeleAdmin.findOne({
      where: { id, woreda_id: req.user.id }
    });
    
    if (!kebeleAdmin) {
      return res.status(404).json({ success: false, message: "Kebele admin not found" });
    }
    
    await kebeleAdmin.update({ status: 'inactive' });
    
    res.json({ success: true, message: "Kebele admin deactivated successfully" });
  } catch (error) {
    console.error("Delete kebele admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== KEBELE HOSPITAL VIEW (FOR WOREDA) ====================

/**
 * Get all hospitals under a specific kebele (for woreda to view)
 */
export const getKebeleHospitals = async (req, res) => {
  try {
    const { kebeleId } = req.params;
    
    // Verify this kebele belongs to the logged-in woreda admin
    const kebele = await KebeleAdmin.findOne({
      where: { id: kebeleId, woreda_id: req.user.id }
    });
    
    if (!kebele) {
      return res.status(404).json({ 
        success: false, 
        message: "Kebele not found or not under your woreda" 
      });
    }
    
    // Get all hospitals under this kebele
    const hospitals = await HospitalAdmin.findAll({
      where: { kebele_id: kebeleId, status: 'active' },
      attributes: ['id', 'hospital_name', 'first_name', 'last_name', 'email', 'phone', 'service_type', 'hospital_type', 'status', 'createdAt']
    });
    
    // Get staff counts for each hospital
    const formattedHospitals = await Promise.all(hospitals.map(async (hospital) => {
      // Get staff count from HospitalStaff model
      let staffCount = 0;
      let departmentCounts = {};
      
      try {
        staffCount = await HospitalStaff.count({
          where: { hospital_id: hospital.id, status: 'active' }
        });
        
        const departmentStats = await HospitalStaff.findAll({
          where: { hospital_id: hospital.id, status: 'active' },
          attributes: ['department', [sequelize.fn('COUNT', sequelize.col('department')), 'count']],
          group: ['department']
        });
        
        departmentStats.forEach(d => {
          departmentCounts[d.department] = parseInt(d.dataValues.count);
        });
      } catch (err) {
        console.log("HospitalStaff model not available yet");
      }
      
      return {
        id: hospital.id,
        name: hospital.hospital_name,
        admin_name: `${hospital.first_name} ${hospital.last_name}`.trim(),
        admin_email: hospital.email,
        admin_phone: hospital.phone,
        service_type: hospital.service_type,
        hospital_type: hospital.hospital_type,
        status: hospital.status,
        created_at: hospital.createdAt,
        staff_count: staffCount,
        departments: departmentCounts,
        code: `HOSP-${String(hospital.id).padStart(4, '0')}`
      };
    }));
    
    res.json({ 
      success: true, 
      hospitals: formattedHospitals,
      total: formattedHospitals.length,
      kebele_name: kebele.kebele_name
    });
    
  } catch (error) {
    console.error("Get kebele hospitals error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT MANAGEMENT ====================

export const sendReport = async (req, res) => {
  try {
    console.log("📝 Sending report from Woreda...");
    console.log("   Files received:", req.files?.length || 0);
    
    const { title, body, priority, recipient_type, recipient_id } = req.body;
    
    const sender = await WoredaAdmin.findByPk(req.user.id, {
      include: [{
        model: ZoneAdmin,
        as: 'zone_admin',
        attributes: ['id', 'zone_name']
      }]
    });
    
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }
    
    let recipient = null;
    let recipientFullName = '';
    let recipientZoneId = null;
    let recipientKebeleId = null;
    
    if (recipient_type === 'zone') {
      recipient = await ZoneAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientZoneId = recipient.id;
      }
    } else if (recipient_type === 'kebele') {
      recipient = await KebeleAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
        recipientKebeleId = recipient.id;
      }
    }
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }
    
    // ✅ Generate unique report number
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const report_number = `RPT-${timestamp}-${randomString}`;
    
    console.log(`📋 Generated unique report number: ${report_number}`);
    
    // ✅ Process attachments from uploaded files
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
      sender_type: 'woreda',
      sender_first_name: sender.first_name, 
      sender_middle_name: sender.middle_name, 
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Woreda Admin - ${sender.woreda_name}`,
      sender_woreda: sender.woreda_name,
      sender_woreda_id: sender.id,
      recipient_id: recipient.id, 
      recipient_type: recipient_type === 'zone' ? 'zone' : 'kebele',
      recipient_first_name: recipient.first_name, 
      recipient_middle_name: recipient.middle_name, 
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_zone: recipient_type === 'zone' ? recipient.zone_name : '',
      recipient_zone_id: recipientZoneId,
      recipient_kebele: recipient_type === 'kebele' ? recipient.kebele_name : '',
      recipient_kebele_id: recipientKebeleId,
      sent_at: new Date(), 
      last_activity_at: new Date()
    });
    
    console.log(`✅ Report created with ID: ${report.id}, Attachments: ${attachments.length}`);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (recipient_type === 'zone') {
        recipientRoom = `zone_${recipientZoneId}`;
      } else if (recipient_type === 'kebele') {
        recipientRoom = `kebele_${recipientKebeleId}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('new_report_from_woreda', {
          report_id: report.id, 
          report_number: report.report_number, 
          title: report.title,
          priority: report.priority, 
          sender_name: `${sender.first_name} ${sender.last_name}`,
          sender_woreda: sender.woreda_name,
          sent_at: report.sent_at, 
          body_preview: body?.substring(0, 100), 
          body: body,
          has_attachments: attachments.length > 0
        });
      }
    }
    
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
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'woreda' };
    
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
      is_reply: !!report.parent_report_id 
    }));
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda', is_opened: false, priority: 'urgent' } });
    
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
      sender_type: 'woreda'
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
      is_reply: !!report.parent_report_id
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
          { sender_id: req.user.id, sender_type: 'woreda' },
          { recipient_id: req.user.id, recipient_type: 'woreda' }
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
    
    await Report.update(
      { 
        is_opened: true, 
        opened_at: new Date(), 
        opened_count: sequelize.literal('opened_count + 1') 
      },
      { 
        where: { 
          recipient_id: req.user.id, 
          recipient_type: 'woreda', 
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
          msg.sender_type === 'kebele' ? 'Kebele Admin' : 
          msg.sender_type === 'zone' ? 'Zone Admin' : 
          'Woreda Admin'
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
          { sender_id: req.user.id, sender_type: 'woreda' }, 
          { recipient_id: req.user.id, recipient_type: 'woreda' }
        ]
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
    const woreda = req.user;
    
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
    let recipientZoneId = null;
    let recipientKebeleId = null;
    
    if (parentReport.sender_type === 'zone') {
      recipient = await ZoneAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientZoneId = recipient.id;
      }
    } else if (parentReport.sender_type === 'kebele') {
      recipient = await KebeleAdmin.findByPk(parentReport.sender_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name || ''} ${recipient.middle_name || ''} ${recipient.last_name || ''}`.trim();
        recipientKebeleId = recipient.id;
      }
    }
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    
    // ✅ Process attachments from files
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachment(s) for reply...`);
      
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToB2(file, woreda.id);
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
      sender_id: woreda.id, 
      sender_type: 'woreda',
      sender_first_name: woreda.first_name, 
      sender_middle_name: woreda.middle_name, 
      sender_last_name: woreda.last_name,
      sender_full_name: `${woreda.first_name || ''} ${woreda.middle_name || ''} ${woreda.last_name || ''}`.trim(),
      sender_title: `Woreda Admin - ${woreda.woreda_name}`, 
      sender_woreda: woreda.woreda_name, 
      sender_woreda_id: woreda.id,
      recipient_id: recipient.id, 
      recipient_type: parentReport.sender_type,
      recipient_first_name: recipient.first_name, 
      recipient_middle_name: recipient.middle_name, 
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_zone: parentReport.sender_type === 'zone' ? recipient.zone_name : '',
      recipient_zone_id: recipientZoneId,
      recipient_kebele: parentReport.sender_type === 'kebele' ? recipient.kebele_name : '',
      recipient_kebele_id: recipientKebeleId,
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
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'zone') {
        recipientRoom = `zone_${recipient.id}`;
      } else if (parentReport.sender_type === 'kebele') {
        recipientRoom = `kebele_${recipient.id}`;
      }
      
      if (recipientRoom) {
        io.to(recipientRoom).emit('report_reply_from_woreda', {
          report_id: reply.id, 
          parent_report_id: parentReport.id, 
          report_number: reply.report_number,
          title: reply.title, 
          priority: reply.priority, 
          sender_name: `${woreda.first_name} ${woreda.last_name}`,
          sender_department: 'Woreda Admin', 
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
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'woreda' }
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
    
    const whereClause = { recipient_id: req.user.id, recipient_type: 'woreda' };
    if (unreadOnly === 'true') whereClause.is_read = false;
    
    const totalCount = await Notification.count({ where: whereClause });
    const notifications = await Notification.findAll({
      where: whereClause, 
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), 
      offset: parseInt(offset)
    });
    
    const unreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda', is_read: false } });
    const urgentUnreadCount = await Notification.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda', is_read: false, priority: 'urgent' } });
    
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
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'woreda' }
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
      where: { recipient_id: req.user.id, recipient_type: 'woreda', is_read: false }
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
    const inboxCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda' } });
    const unreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda', is_opened: false } });
    const urgentUnreadCount = await Report.count({ where: { recipient_id: req.user.id, recipient_type: 'woreda', is_opened: false, priority: 'urgent' } });
    const outboxCount = await Report.count({ where: { sender_id: req.user.id, sender_type: 'woreda' } });
    const kebeleCount = await KebeleAdmin.count({ where: { woreda_id: req.user.id, status: 'active' } });
    
    // Get total hospitals under all kebeles
    const kebeles = await KebeleAdmin.findAll({
      where: { woreda_id: req.user.id, status: 'active' },
      attributes: ['id']
    });
    const kebeleIds = kebeles.map(k => k.id);
    const hospitalCount = await HospitalAdmin.count({ where: { kebele_id: kebeleIds, status: 'active' } });
    
    res.json({ 
      success: true, 
      stats: { 
        inbox: inboxCount, 
        unread: unreadCount,
        urgentUnread: urgentUnreadCount,
        outbox: outboxCount, 
        kebeles: kebeleCount,
        hospitals: hospitalCount,
        drafts: 0,
        closed: 0
      } 
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add this function after the getOutbox function and before getReportById

