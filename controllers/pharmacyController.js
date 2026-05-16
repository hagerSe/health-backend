// controllers/pharmacyController.js
import Prescription from '../models/Prescription.js';
import Inventory from '../models/Inventory.js';
import Patient from '../models/Patient.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ==================== MULTER CONFIGURATION ====================
const reportsDir = 'uploads/reports';
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reportsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pharmacy-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// ==================== HELPER FUNCTIONS ====================
const generatePrescriptionNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const todayCount = await Prescription.count({
    where: {
      createdAt: {
        [Op.gte]: new Date(date.setHours(0, 0, 0, 0)),
        [Op.lte]: new Date(date.setHours(23, 59, 59, 999))
      }
    }
  });
  
  const sequence = String(todayCount + 1).padStart(4, '0');
  return `RX-${dateStr}-${sequence}`;
};

// ==================== PRESCRIPTION ROUTES ====================

// @desc    Get pending prescriptions
// @route   GET /api/pharmacy/pending
// @access  Private
export const getPendingPrescriptions = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id),
      status: { [Op.in]: ['pending', 'prepared'] }
    };

    if (ward && ward !== 'all') {
      whereClause.ward = ward;
    }

    const prescriptions = await Prescription.findAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'first_name', 'last_name', 'gender', 'age', 'phone', 'card_number'],
          required: false
        },
        {
          model: HospitalStaff,
          as: 'doctor',
          attributes: ['id', 'first_name', 'last_name', 'department'],
          required: false
        }
      ],
      order: [['priority', 'ASC'], ['createdAt', 'DESC']]
    });

    const formattedPrescriptions = prescriptions.map(p => {
      const data = p.toJSON();
      let items = data.items;
      
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      
      return {
        id: data.id,
        prescription_number: data.prescription_number,
        patient_id: data.patient_id,
        patient_name: data.patient_name,
        patient: data.patient ? {
          id: data.patient.id,
          first_name: data.patient.first_name,
          last_name: data.patient.last_name,
          full_name: `${data.patient.first_name} ${data.patient.last_name}`,
          gender: data.patient.gender,
          age: data.patient.age,
          phone: data.patient.phone,
          card_number: data.patient.card_number
        } : null,
        doctor_id: data.doctor_id,
        doctor_name: data.doctor_name,
        doctor: data.doctor ? {
          id: data.doctor.id,
          name: `${data.doctor.first_name} ${data.doctor.last_name}`,
          department: data.doctor.department
        } : null,
        ward: data.ward,
        priority: data.priority,
        status: data.status,
        items: Array.isArray(items) ? items : [],
        notes: data.notes,
        prescribed_at: data.createdAt,
        prepared_at: data.prepared_at,
        dispensed_at: data.dispensed_at
      };
    });

    res.json({ success: true, prescriptions: formattedPrescriptions, count: formattedPrescriptions.length });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single prescription by ID
// @route   GET /api/pharmacy/prescription/:id
// @access  Private
export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await Prescription.findByPk(id, {
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'gender', 'age', 'phone'] },
        { model: HospitalStaff, as: 'doctor', attributes: ['id', 'first_name', 'last_name', 'department'] }
      ]
    });

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const data = prescription.toJSON();
    let items = data.items;
    
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }

    res.json({ success: true, prescription: { ...data, items: Array.isArray(items) ? items : [] } });
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Prepare prescription
// @route   PUT /api/pharmacy/prepare/:id
// @access  Private
export const preparePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacist_name } = req.body;

    const prescription = await Prescription.findByPk(id);

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    if (prescription.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot prepare prescription with status: ${prescription.status}` });
    }

    await prescription.update({
      status: 'prepared',
      prepared_at: new Date(),
      prepared_by: pharmacist_name
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${prescription.hospital_id}_pharmacy`).emit('prescription_prepared', {
        prescription_id: prescription.id,
        patient_name: prescription.patient_name
      });
    }

    res.json({ success: true, message: 'Prescription prepared successfully', prescription });
  } catch (error) {
    console.error('Error preparing prescription:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dispense prescription
// @route   PUT /api/pharmacy/dispense/:id
// @access  Private
export const dispensePrescription = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { pharmacist_name, notes } = req.body;

    const prescription = await Prescription.findByPk(id, { transaction });

    if (!prescription) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    if (prescription.status === 'dispensed') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Prescription already dispensed' });
    }

    let items = prescription.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }

    // Update inventory for each item
    for (const item of items) {
      const inventoryItem = await Inventory.findOne({
        where: { name: { [Op.iLike]: item.name }, hospital_id: prescription.hospital_id },
        transaction
      });

      if (!inventoryItem) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Medication "${item.name}" not found in inventory` });
      }

      if (inventoryItem.current_stock < (item.quantity || 1)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Insufficient stock for ${item.name}` });
      }

      await inventoryItem.update({
        current_stock: inventoryItem.current_stock - (item.quantity || 1),
        last_updated: new Date()
      }, { transaction });
    }

    await prescription.update({
      status: 'dispensed',
      dispensed_at: new Date(),
      dispensed_by: pharmacist_name,
      notes: notes || prescription.notes
    }, { transaction });

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${prescription.hospital_id}_pharmacy`).emit('prescription_dispensed', {
        prescription_id: prescription.id,
        prescription_number: prescription.prescription_number,
        patient_name: prescription.patient_name,
        doctor_name: prescription.doctor_name,
        dispensed_by: pharmacist_name,
        dispensed_at: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Prescription dispensed successfully', prescription });
  } catch (error) {
    await transaction.rollback();
    console.error('Error dispensing prescription:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel prescription
// @route   PUT /api/pharmacy/cancel/:id
// @access  Private
export const cancelPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cancelled_by } = req.body;

    const prescription = await Prescription.findByPk(id);

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    if (prescription.status === 'dispensed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel already dispensed prescription' });
    }

    await prescription.update({
      status: 'cancelled',
      notes: reason ? `${prescription.notes}\nCancelled: ${reason}` : prescription.notes,
      prepared_at: null,
      prepared_by: null
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${prescription.hospital_id}_pharmacy`).emit('prescription_cancelled', {
        prescription_id: prescription.id,
        patient_name: prescription.patient_name,
        reason
      });
    }

    res.json({ success: true, message: 'Prescription cancelled successfully', prescription });
  } catch (error) {
    console.error('Error cancelling prescription:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== INVENTORY ROUTES ====================

// @desc    Get inventory
// @route   GET /api/pharmacy/inventory
// @access  Private
export const getInventory = async (req, res) => {
  try {
    const { hospital_id } = req.query;

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const inventory = await Inventory.findAll({
      where: { hospital_id: parseInt(hospital_id) },
      order: [['name', 'ASC']]
    });

    res.json({ success: true, inventory });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update inventory
// @route   PUT /api/pharmacy/inventory/:id
// @access  Private
export const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_stock, reorder_level, unit, expiry_date } = req.body;

    const inventory = await Inventory.findByPk(id);

    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    await inventory.update({
      current_stock: current_stock !== undefined ? current_stock : inventory.current_stock,
      reorder_level: reorder_level !== undefined ? reorder_level : inventory.reorder_level,
      unit: unit || inventory.unit,
      expiry_date: expiry_date || inventory.expiry_date,
      last_updated: new Date()
    });

    res.json({ success: true, message: 'Inventory updated successfully', inventory });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add inventory item
// @route   POST /api/pharmacy/inventory
// @access  Private
export const addInventory = async (req, res) => {
  try {
    const { hospital_id, name, category, current_stock, unit, reorder_level, expiry_date, manufacturer, notes } = req.body;

    const existingItem = await Inventory.findOne({
      where: { name: { [Op.iLike]: name }, hospital_id: parseInt(hospital_id) }
    });

    if (existingItem) {
      return res.status(400).json({ success: false, message: 'Item already exists in inventory' });
    }

    const inventory = await Inventory.create({
      hospital_id: parseInt(hospital_id),
      name,
      category: category || 'medication',
      current_stock: current_stock || 0,
      unit,
      reorder_level: reorder_level || 10,
      expiry_date: expiry_date || null,
      manufacturer: manufacturer || null,
      notes: notes || null
    });

    res.json({ success: true, message: 'Inventory item added successfully', inventory });
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get low stock items
// @route   GET /api/pharmacy/low-stock
// @access  Private
export const getLowStock = async (req, res) => {
  try {
    const { hospital_id } = req.query;

    if (!hospital_id) {
      return res.status(400).json({ success: false, message: 'hospital_id is required' });
    }

    const lowStockItems = await Inventory.findAll({
      where: {
        hospital_id: parseInt(hospital_id),
        current_stock: { [Op.lte]: sequelize.col('reorder_level') }
      },
      order: [['current_stock', 'ASC']]
    });

    res.json({ success: true, lowStockItems });
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get today's stats
// @route   GET /api/pharmacy/stats/today
// @access  Private
export const getTodayStats = async (req, res) => {
  try {
    const { hospital_id, date } = req.query;
    
    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [dispensedCount, pendingCount] = await Promise.all([
      Prescription.count({
        where: {
          hospital_id: parseInt(hospital_id),
          status: 'dispensed',
          dispensed_at: { [Op.between]: [today, tomorrow] }
        }
      }),
      Prescription.count({
        where: {
          hospital_id: parseInt(hospital_id),
          status: { [Op.in]: ['pending', 'prepared'] }
        }
      })
    ]);

    res.json({ success: true, dispensedCount, pendingCount });
  } catch (error) {
    console.error('Error fetching today stats:', error);
    res.json({ success: true, dispensedCount: 0, pendingCount: 0 });
  }
};

// ==================== PROFILE ROUTES ====================

// @desc    Get pharmacy staff profile
// @route   GET /api/pharmacy/profile
// @access  Private
export const getPharmacyProfile = async (req, res) => {
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
    console.error("Get pharmacy profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update pharmacy staff profile
// @route   PUT /api/pharmacy/profile
// @access  Private
export const updatePharmacyProfile = async (req, res) => {
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
    console.error("Update pharmacy profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change pharmacy staff password
// @route   PUT /api/pharmacy/change-password
// @access  Private
export const changePharmacyPassword = async (req, res) => {
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

// ==================== REPORT ROUTES ====================

// @desc    Get hospital admins for pharmacy
// @route   GET /api/pharmacy/hospital-admins
// @access  Private
export const getHospitalAdminsForPharmacy = async (req, res) => {
  try {
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { id: req.user.hospital_id },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    const formattedAdmins = hospitalAdmins.map(admin => ({
      id: admin.id,
      full_name: `${admin.first_name} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name}`.trim(),
      email: admin.email,
      hospital_name: admin.hospital_name,
      hospital_id: admin.id
    }));
    
    res.json({ success: true, admins: formattedAdmins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.json({ success: true, admins: [] });
  }
};

// @desc    Get pharmacy reports inbox
// @route   GET /api/pharmacy/reports/inbox
// @access  Private
export const getPharmacyReportsInbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { recipient_id: req.user.id, recipient_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    
    const unreadCount = reports.filter(r => !r.is_opened).length;
    res.json({ success: true, reports, unreadCount });
  } catch (error) {
    console.error("Get pharmacy reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pharmacy reports outbox
// @route   GET /api/pharmacy/reports/outbox
// @access  Private
export const getPharmacyReportsOutbox = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { sender_id: req.user.id, sender_type: 'staff' },
      order: [['sent_at', 'DESC']]
    });
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Get pharmacy reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send pharmacy report
// @route   POST /api/pharmacy/reports/send
// @access  Private
export const sendPharmacyReport = async (req, res) => {
  try {
    const { title, body, priority, recipient_id } = req.body;

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const recipient = await HospitalAdmin.findByPk(recipient_id);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const report = await Report.create({
      report_number,
      title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.last_name}`,
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: `${recipient.first_name} ${recipient.last_name}`,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${recipient.id}_admin`).emit('new_report_from_pharmacy', {
        report_id: report.id,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send pharmacy report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reply to pharmacy report
// @route   POST /api/pharmacy/reports/:id/reply
// @access  Private
export const replyToPharmacyReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    const report_number = `RPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      body,
      priority: parentReport.priority,
      status: 'sent',
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.last_name}`,
      recipient_id: parentReport.sender_id,
      recipient_type: parentReport.sender_type,
      recipient_first_name: parentReport.sender_first_name,
      recipient_last_name: parentReport.sender_last_name,
      recipient_full_name: parentReport.sender_full_name,
      parent_report_id: parentReport.id,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    await parentReport.update({ status: 'replied', last_activity_at: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.to(`staff_${parentReport.sender_id}`).emit('report_reply_from_pharmacy', {
        report_id: reply.id,
        title: reply.title,
        sender_name: `${sender.first_name} ${sender.last_name}`
      });
    }

    res.json({ success: true, reply, message: "Reply sent successfully" });
  } catch (error) {
    console.error("Reply to pharmacy report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark pharmacy report as read
// @route   PUT /api/pharmacy/reports/:id/read
// @access  Private
export const markPharmacyReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, recipient_id: req.user.id, recipient_type: 'staff' }
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