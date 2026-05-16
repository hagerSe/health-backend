import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { validationResult } from "express-validator";
import RegionalAdmin from "../models/RegionalAdmin.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";

// ==================== CREATE REGIONAL ADMIN ====================
export const createRegionalAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      region_name,
      first_name,
      middle_name,
      last_name,
      gender,
      age,
      email,
      password,
      phone
    } = req.body;

    // Check if email exists
    const existingAdmin = await RegionalAdmin.findOne({ 
      where: { email } 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Email already exists" 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create regional admin
    const newRegionalAdmin = await RegionalAdmin.create({
      federal_id: req.admin.id,
      region_name,
      first_name,
      middle_name,
      last_name,
      gender,
      age,
      email,
      password: hashedPassword,
      phone,
      role: "Regional_Admin"
    });

    // Create notification for federal admin
    await Notification.create({
      federal_admin_id: req.admin.id,
      title: "Regional Admin Created",
      message: `New regional admin ${first_name} ${last_name} created for ${region_name} region`,
      type: "success"
    });

    res.status(201).json({
      success: true,
      message: "Regional admin created successfully",
      regional_admin: {
        id: newRegionalAdmin.id,
        first_name: newRegionalAdmin.first_name,
        last_name: newRegionalAdmin.last_name,
        email: newRegionalAdmin.email,
        region_name: newRegionalAdmin.region_name,
        role: newRegionalAdmin.role,
        created_at: newRegionalAdmin.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== VIEW ALL REGIONAL ADMINS ====================
export const getAllRegionalAdmins = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const offset = (page - 1) * limit;
    
    const whereClause = {
      federal_id: req.admin.id
    };
    
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { region_name: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await RegionalAdmin.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Get report counts for each regional admin
    const regionalAdminsWithCounts = await Promise.all(
      rows.map(async (admin) => {
        const reportCount = await Report.count({
          where: { regional_admin_id: admin.id }
        });
        
        return {
          ...admin.toJSON(),
          report_count: reportCount
        };
      })
    );

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      regional_admins: regionalAdminsWithCounts
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== VIEW SINGLE REGIONAL ADMIN ====================
export const getRegionalAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const regionalAdmin = await RegionalAdmin.findOne({
      where: { 
        id, 
        federal_id: req.admin.id 
      },
      attributes: { exclude: ['password'] }
    });

    if (!regionalAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: "Regional admin not found" 
      });
    }

    // Get their reports
    const reports = await Report.findAll({
      where: { regional_admin_id: id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      regional_admin: regionalAdmin,
      reports
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== UPDATE REGIONAL ADMIN ====================
export const updateRegionalAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      region_name,
      first_name,
      last_name,
      phone
    } = req.body;

    const regionalAdmin = await RegionalAdmin.findOne({
      where: { 
        id, 
        federal_id: req.admin.id 
      }
    });

    if (!regionalAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: "Regional admin not found" 
      });
    }

    await regionalAdmin.update({
      region_name: region_name || regionalAdmin.region_name,
      first_name: first_name || regionalAdmin.first_name,
      last_name: last_name || regionalAdmin.last_name,
      phone: phone || regionalAdmin.phone
    });

    // Create notification
    await Notification.create({
      federal_admin_id: req.admin.id,
      title: "Regional Admin Updated",
      message: `Updated information for ${regionalAdmin.first_name} ${regionalAdmin.last_name}`,
      type: "info"
    });

    res.json({
      success: true,
      message: "Regional admin updated",
      regional_admin: {
        id: regionalAdmin.id,
        first_name: regionalAdmin.first_name,
        last_name: regionalAdmin.last_name,
        email: regionalAdmin.email,
        region_name: regionalAdmin.region_name,
        phone: regionalAdmin.phone
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== DELETE REGIONAL ADMIN ====================
export const deleteRegionalAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const regionalAdmin = await RegionalAdmin.findOne({
      where: { 
        id, 
        federal_id: req.admin.id 
      }
    });

    if (!regionalAdmin) {
      return res.status(404).json({ 
        success: false, 
        message: "Regional admin not found" 
      });
    }

    const name = `${regionalAdmin.first_name} ${regionalAdmin.last_name}`;
    
    await regionalAdmin.destroy();

    // Create notification
    await Notification.create({
      federal_admin_id: req.admin.id,
      title: "Regional Admin Deleted",
      message: `Deleted regional admin: ${name}`,
      type: "warning"
    });

    res.json({
      success: true,
      message: "Regional admin deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};