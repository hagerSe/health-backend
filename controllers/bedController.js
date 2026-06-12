// backend/controllers/bedController.js
import Bed from '../models/Bed.js';
import Admission from '../models/Admission.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import { uploadToB2, parseAttachments, formatAttachmentsForResponse } from '../Services/b2Upload.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';

// ==================== HELPER FUNCTIONS ====================
const calculateOccupancyRate = (total, occupied) => {
  if (!total || total === 0) return 0;
  return Math.round((occupied / total) * 100);
};

// ==================== BED MANAGEMENT FUNCTIONS ====================

// @desc    Get available beds by ward
export const getAvailableBeds = async (req, res) => {
  try {
    const { ward, hospital_id } = req.query;
    const hospitalId = hospital_id || req.user?.hospital_id;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const beds = await Bed.findAll({
      where: {
        hospital_id: hospitalId,
        ward: ward,
        status: 'available'
      },
      order: [['number', 'ASC']],
      attributes: ['id', 'number', 'type', 'notes']
    });

    res.json({ success: true, beds, count: beds.length });
  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all beds
export const getAllBeds = async (req, res) => {
  try {
    const { ward, status, type, hospital_id } = req.query;
    const hospitalId = hospital_id || req.user?.hospital_id || req.user?.hospitalId;

    console.log('🛏️ Fetching beds for hospital_id:', hospitalId);

    if (!hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'hospital_id is required' 
      });
    }

    const whereClause = { hospital_id: parseInt(hospitalId) };
    if (ward && ward !== 'all') whereClause.ward = ward;
    if (status && status !== 'all') whereClause.status = status;
    if (type && type !== 'all') whereClause.type = type;

    const beds = await Bed.findAll({
      where: whereClause,
      order: [['ward', 'ASC'], ['number', 'ASC']],
      attributes: ['id', 'number', 'ward', 'type', 'status', 'notes', 'current_patient_name', 'current_patient_id', 'last_cleaned_at', 'last_occupied_at', 'createdAt', 'updatedAt']
    });

    console.log(`✅ Found ${beds.length} beds`);
    res.json({ success: true, beds, count: beds.length });
  } catch (error) {
    console.error('❌ Error fetching beds:', error);
    res.json({ success: true, beds: [], count: 0, message: error.message });
  }
};

// @desc    Get bed by ID
export const getBedById = async (req, res) => {
  try {
    const { id } = req.params;
    const bed = await Bed.findByPk(id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }
    res.json({ success: true, bed });
  } catch (error) {
    console.error('Error fetching bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register new bed
export const registerBed = async (req, res) => {
  try {
    const { number, ward, type, notes, hospital_id } = req.body;
    
    let hospitalId = hospital_id || req.user?.hospital_id || req.user?.hospitalId;
    
    console.log('📝 Register bed request:', { number, ward, type, hospitalId });
    
    if (!number) {
      return res.status(400).json({ success: false, message: 'Bed number is required' });
    }
    if (!ward) {
      return res.status(400).json({ success: false, message: 'Ward is required' });
    }
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital ID is required' });
    }
    
    const staffId = req.user?.id || null;
    const validWards = ['OPD', 'EME', 'ANC'];
    const normalizedWard = ward.toUpperCase();
    
    if (!validWards.includes(normalizedWard)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid ward. Must be one of: ${validWards.join(', ')}` 
      });
    }
    
    const existingBed = await Bed.findOne({
      where: { hospital_id: hospitalId, ward: normalizedWard, number: number }
    });
    
    if (existingBed) {
      return res.status(400).json({ 
        success: false, 
        message: `Bed ${number} already exists in ${normalizedWard} ward` 
      });
    }
    
    const newBed = await Bed.create({
      hospital_id: hospitalId,
      number: number,
      ward: normalizedWard,
      type: type || 'general',
      status: 'available',
      notes: notes || '',
      last_cleaned_at: new Date(),
      created_by: staffId
    });
    
    console.log(`✅ Bed ${number} added to ${normalizedWard} ward`);
    
    const io = req.app?.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_bed_management`).emit('new_bed_added', {
        bed_id: newBed.id,
        bed_number: number,
        ward: normalizedWard,
        hospital_id: hospitalId
      });
    }
    
    res.status(201).json({ 
      success: true, 
      message: `Bed ${number} registered successfully`, 
      bed: newBed 
    });
    
  } catch (error) {
    console.error('❌ Error registering bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update bed status
export const updateBedStatus = async (req, res) => {
  try {
    const { bedId } = req.params;
    const { status, notes } = req.body;
    const staffId = req.user.id;

    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved', 'cleaning'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const bed = await Bed.findByPk(bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    const previousStatus = bed.status;
    const bedNumber = bed.number;
    const hospitalId = bed.hospital_id;

    await bed.update({
      status,
      notes: notes || bed.notes,
      updated_by: staffId,
      updated_at: new Date()
    });

    if (status === 'available' && previousStatus === 'maintenance') {
      await bed.update({ last_cleaned_at: new Date() });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_bed_management`).emit('bed_status_updated', {
        bed_id: bed.id,
        bed_number: bedNumber,
        status: status,
        old_status: previousStatus
      });
    }

    res.json({ success: true, message: `Bed status updated to ${status}`, bed, previous_status: previousStatus });
  } catch (error) {
    console.error('Error updating bed status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign bed to patient
export const assignBed = async (req, res) => {
  try {
    const { bed_id, patient_id, patient_name, doctor_name, ward, hospital_id, reason } = req.body;
    const hospitalId = hospital_id || req.user?.hospital_id;

    const bed = await Bed.findByPk(bed_id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status !== 'available') {
      return res.status(400).json({ success: false, message: `Bed is not available (current status: ${bed.status})` });
    }

    await bed.update({
      status: 'occupied',
      current_patient_id: patient_id,
      current_patient_name: patient_name,
      last_occupied_at: new Date(),
      updated_at: new Date()
    });

    const admission = await Admission.create({
      patient_id,
      patient_name,
      doctor_name,
      hospital_id: hospitalId,
      ward: ward || bed.ward,
      bed_id: bed.id,
      bed_number: bed.number,
      admitted_at: new Date(),
      status: 'active',
      reason: reason || 'Medical admission'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}_bed_management`).emit('bed_occupied', {
        bed_id: bed.id,
        bed_number: bed.number,
        patient_id,
        patient_name,
        ward: bed.ward,
        admission_id: admission.id
      });
    }

    res.json({ success: true, message: 'Bed assigned successfully', bed, admission });
  } catch (error) {
    console.error('Error assigning bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Release bed
export const releaseBed = async (req, res) => {
  try {
    const { bed_id, reason, discharge_notes } = req.body;

    const bed = await Bed.findByPk(bed_id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    const previousPatient = {
      patient_id: bed.current_patient_id,
      patient_name: bed.current_patient_name
    };

    await Admission.update(
      { status: 'discharged', discharged_at: new Date(), discharge_summary: discharge_notes || reason },
      { where: { bed_id: bed.id, status: 'active' } }
    );

    await bed.update({
      status: 'cleaning',
      current_patient_id: null,
      current_patient_name: null,
      notes: reason ? `Released: ${reason}` : bed.notes,
      updated_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${bed.hospital_id}_bed_management`).emit('bed_released', {
        bed_id: bed.id,
        bed_number: bed.number,
        ward: bed.ward,
        previous_patient: previousPatient
      });
    }

    res.json({ success: true, message: 'Bed released successfully', bed, previous_patient: previousPatient });
  } catch (error) {
    console.error('Error releasing bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clean bed
export const cleanBed = async (req, res) => {
  try {
    const { bed_id } = req.body;

    const bed = await Bed.findByPk(bed_id);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status !== 'cleaning' && bed.status !== 'maintenance') {
      return res.status(400).json({ success: false, message: `Bed must be in cleaning or maintenance status to clean` });
    }

    await bed.update({
      status: 'available',
      last_cleaned_at: new Date(),
      updated_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${bed.hospital_id}_bed_management`).emit('bed_cleaned', {
        bed_id: bed.id,
        bed_number: bed.number,
        ward: bed.ward
      });
    }

    res.json({ success: true, message: 'Bed marked as cleaned', bed });
  } catch (error) {
    console.error('Error cleaning bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get ward statistics
export const getWardStats = async (req, res) => {
  try {
    const { hospital_id } = req.query;
    const hospitalId = hospital_id || req.user?.hospital_id || req.user?.hospitalId;
    
    console.log('📊 Fetching ward stats for hospital_id:', hospitalId);
    
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const wards = ['OPD', 'EME', 'ANC'];
    const stats = [];

    for (const ward of wards) {
      const [total, available, occupied, maintenance, reserved, cleaning] = await Promise.all([
        Bed.count({ where: { hospital_id: hospitalId, ward } }).catch(() => 0),
        Bed.count({ where: { hospital_id: hospitalId, ward, status: 'available' } }).catch(() => 0),
        Bed.count({ where: { hospital_id: hospitalId, ward, status: 'occupied' } }).catch(() => 0),
        Bed.count({ where: { hospital_id: hospitalId, ward, status: 'maintenance' } }).catch(() => 0),
        Bed.count({ where: { hospital_id: hospitalId, ward, status: 'reserved' } }).catch(() => 0),
        Bed.count({ where: { hospital_id: hospitalId, ward, status: 'cleaning' } }).catch(() => 0)
      ]);
      
      const occupancyRate = total === 0 ? 0 : Math.round((occupied / total) * 100);

      stats.push({
        ward,
        total: total || 0,
        available: available || 0,
        occupied: occupied || 0,
        maintenance: maintenance || 0,
        reserved: reserved || 0,
        cleaning: cleaning || 0,
        occupancyRate
      });
    }
    
    console.log('✅ Ward stats calculated:', stats);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error fetching ward stats:', error);
    res.json({ 
      success: true, 
      stats: [
        { ward: 'OPD', total: 0, available: 0, occupied: 0, maintenance: 0, reserved: 0, cleaning: 0, occupancyRate: 0 },
        { ward: 'EME', total: 0, available: 0, occupied: 0, maintenance: 0, reserved: 0, cleaning: 0, occupancyRate: 0 },
        { ward: 'ANC', total: 0, available: 0, occupied: 0, maintenance: 0, reserved: 0, cleaning: 0, occupancyRate: 0 }
      ]
    });
  }
};

// @desc    Get bed logs
export const getBedLogs = async (req, res) => {
  try {
    const { bedId } = req.params;
    const { limit = 50 } = req.query;

    const bed = await Bed.findByPk(bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    const admissions = await Admission.findAll({
      where: { bed_id: bedId },
      order: [['admitted_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({ success: true, bed, admissions, count: admissions.length });
  } catch (error) {
    console.error('Error fetching bed logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete bed
export const deleteBed = async (req, res) => {
  try {
    const { bedId } = req.params;

    const bed = await Bed.findByPk(bedId);
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status === 'occupied') {
      return res.status(400).json({ success: false, message: 'Cannot delete an occupied bed' });
    }

    await bed.destroy();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${bed.hospital_id}_bed_management`).emit('bed_deleted', {
        bed_id: bedId,
        bed_number: bed.number,
        ward: bed.ward
      });
    }

    res.json({ success: true, message: 'Bed deleted successfully' });
  } catch (error) {
    console.error('Error deleting bed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PROFILE FUNCTIONS ====================

export const getBedManagementProfile = async (req, res) => {
  try {
    const staff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    
    res.json({ 
      success: true, 
      staff: {
        ...staff.toJSON(),
        full_name: `${staff.first_name} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name}`.trim()
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBedManagementProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
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
    
    res.json({ success: true, staff: updatedStaff, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeBedManagementPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    
    const isMatch = await bcrypt.compare(current_password, staff.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await staff.update({ password: hashedPassword });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORT FUNCTIONS WITH B2 ATTACHMENTS ====================

export const getHospitalAdminsForBedManagement = async (req, res) => {
  try {
    const hospitalAdmin = await HospitalAdmin.findByPk(req.user.hospital_id, {
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    let admins = [];
    
    if (hospitalAdmin) {
      admins = [{
        id: hospitalAdmin.id,
        full_name: `${hospitalAdmin.first_name} ${hospitalAdmin.middle_name ? hospitalAdmin.middle_name + ' ' : ''}${hospitalAdmin.last_name}`.trim(),
        email: hospitalAdmin.email,
        hospital_name: hospitalAdmin.hospital_name,
        hospital_id: hospitalAdmin.id
      }];
    } else {
      admins = [{
        id: req.user.id,
        full_name: `${req.user.first_name} ${req.user.middle_name ? req.user.middle_name + ' ' : ''}${req.user.last_name}`.trim(),
        email: req.user.email,
        hospital_name: req.user.hospital_name,
        hospital_id: req.user.hospital_id
      }];
    }
    
    res.json({ success: true, admins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.json({ 
      success: true, 
      admins: [{
        id: req.user.hospital_id || 1,
        full_name: 'Hospital Administrator',
        email: 'admin@hospital.com',
        hospital_name: req.user.hospital_name || 'General Hospital',
        hospital_id: req.user.hospital_id || 1
      }]
    });
  }
};

export const getBedManagementReportsInbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff'
      },
      order: [['sent_at', 'DESC']]
    });
    
    // Parse attachments for each report
    const formattedReports = reports.map(report => ({
      ...report.toJSON(),
      attachments: parseAttachments(report.attachments),
      attachments_count: parseAttachments(report.attachments).length
    }));
    
    const unreadCount = reports.filter(r => !r.is_opened).length;
    res.json({ success: true, reports: formattedReports, unreadCount });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBedManagementReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: {
        sender_id: req.user.id,
        sender_type: 'staff'
      },
      order: [['sent_at', 'DESC']]
    });
    
    const formattedReports = reports.map(report => ({
      ...report.toJSON(),
      attachments: parseAttachments(report.attachments),
      attachments_count: parseAttachments(report.attachments).length
    }));
    
    res.json({ success: true, reports: formattedReports });
  } catch (error) {
    console.error("Get outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ FIXED: Send Report with B2 attachments
export const sendBedManagementReport = async (req, res) => {
  try {
    const { title, body, priority, recipient_id } = req.body;

    console.log("📝 Sending report from Bed Management...");
    console.log("   Files received:", req.files?.length || 0);

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const recipient = await HospitalAdmin.findByPk(recipient_id);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    // ✅ Process attachments using B2
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

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const report = await Report.create({
      report_number,
      title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      attachments: attachments,  // ✅ Now using B2 attachments
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim(),
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    console.log(`✅ Report created with ID: ${report.id}, Attachments: ${attachments.length}`);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${recipient.id}_admin`).emit('new_report_from_bed_management', {
        report_id: report.id,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        has_attachments: attachments.length > 0
      });
    }

    res.status(201).json({ 
      success: true, 
      report: {
        id: report.id,
        report_number: report.report_number,
        title: report.title,
        attachments_count: attachments.length,
        attachments: formatAttachmentsForResponse(attachments)
      }, 
      message: "Report sent successfully" 
    });
  } catch (error) {
    console.error("Send report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ FIXED: Reply to Report with B2 attachments
export const replyToBedManagementReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Allow reply with attachment even if no text
    if (!body && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reply message or attachment is required' 
      });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    // ✅ Process attachments using B2
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} attachments for reply...`);
      
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
          // Continue with other files even if one fails
        }
      }
    }

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const threadId = parentReport.thread_id || parentReport.id;

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject || parentReport.title,
      body: body || '',
      priority: parentReport.priority,
      status: 'sent',
      attachments: attachments,
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      recipient_id: parentReport.sender_id,
      recipient_type: parentReport.sender_type,
      recipient_first_name: parentReport.sender_first_name,
      recipient_middle_name: parentReport.sender_middle_name,
      recipient_last_name: parentReport.sender_last_name,
      recipient_full_name: parentReport.sender_full_name,
      parent_report_id: parentReport.id,
      thread_id: threadId,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    console.log(`✅ Reply created with ID: ${reply.id}, Attachments: ${attachments.length}`);

    // Update parent report
    await parentReport.update({ 
      status: 'replied', 
      last_activity_at: new Date(),
      reply_count: (parentReport.reply_count || 0) + 1
    });

    // Send socket notification
    const io = req.app.get('io');
    if (io) {
      const recipientRoom = parentReport.sender_type === 'hospital' 
        ? `hospital_${parentReport.sender_id}_admin`
        : `staff_${parentReport.sender_id}`;
        
      io.to(recipientRoom).emit('report_reply_from_bed_management', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        title: reply.title,
        priority: reply.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_department: 'Bed Management',
        sent_at: reply.sent_at,
        body_preview: (body || '').substring(0, 100),
        is_reply: true,
        has_attachments: attachments.length > 0
      });
    }

    // Create database notification
    try {
      await Notification.create({
        recipient_id: parentReport.sender_id,
        recipient_type: parentReport.sender_type,
        title: `Reply to: ${parentReport.title}`,
        message: `You have received a reply from ${sender.first_name} ${sender.last_name} (Bed Management)`,
        type: 'reply_received',
        priority: parentReport.priority,
        reference_id: reply.id,
        is_read: false
      });
    } catch (notifError) {
      console.warn("⚠️ Notification creation failed:", notifError.message);
    }

    res.json({ 
      success: true, 
      reply: {
        id: reply.id,
        title: reply.title,
        body: reply.body,
        attachments: attachments.map(att => ({
          filename: att.filename,
          originalName: att.originalName,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
          key: att.key
        })),
        attachments_count: attachments.length,
        sent_at: reply.sent_at
      }, 
      message: "Reply sent successfully" 
    });
  } catch (error) {
    console.error("Reply to report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markBedManagementReportRead = async (req, res) => {
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