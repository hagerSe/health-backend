import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import crypto from "crypto";
import User from "../models/User.js"; 
import FederalAdmin from "../models/FederalAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import WoredaAdmin from "../models/WoredaAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import HospitalStaff from "../models/HospitalStaff.js";
import { sendVerificationEmail, sendResetPasswordEmail } from "../utils/emailService.js";

// ==================== DEVELOPMENT CONFIGURATION ====================
const isDevelopment = process.env.NODE_ENV === 'development';

// ==================== HELPER: CHECK EMAIL IN ALL TABLES ====================
const checkEmailInAllTables = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check all tables sequentially
  const federalExists = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
  if (federalExists) return { exists: true, table: 'Federal Admin' };
  
  const regionalExists = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
  if (regionalExists) return { exists: true, table: 'Regional Admin' };
  
  const zoneExists = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
  if (zoneExists) return { exists: true, table: 'Zone Admin' };
  
  const woredaExists = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
  if (woredaExists) return { exists: true, table: 'Woreda Admin' };
  
  const kebeleExists = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
  if (kebeleExists) return { exists: true, table: 'Kebele Admin' };
  
  const hospitalExists = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
  if (hospitalExists) return { exists: true, table: 'Hospital Admin' };
  
  const staffExists = await HospitalStaff.findOne({ where: { email: normalizedEmail } });
  if (staffExists) return { exists: true, table: 'Hospital Staff' };
  
  const userExists = await User.findOne({ where: { email: normalizedEmail } });
  if (userExists) return { exists: true, table: 'User' };
  
  return { exists: false, table: null };
};

// ==================== LOGIN FUNCTION - WORKS FOR ALL TABLES (INCLUDING USER) ====================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("=".repeat(60));
    console.log("🔐 Login attempt for email:", email);
    console.log("=".repeat(60));

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = null;
    let role = null;
    let userType = null;
    let userModel = null;

    // ✅ 1. CHECK USER TABLE FIRST
    user = await User.findOne({ where: { email: normalizedEmail } });
    if (user) {
      role = user.role || 'staff';
      userType = user.role === 'staff' ? 'staff' : user.role;
      userModel = 'User';
      console.log("✅ User found in User table, role:", role);
    }

    // ✅ 2. CHECK FEDERAL ADMIN
    if (!user) {
      user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Federal_Admin';
        userType = 'federal';
        userModel = 'FederalAdmin';
        console.log("✅ User found in FederalAdmin table");
      }
    }

    // ✅ 3. CHECK REGIONAL ADMIN
    if (!user) {
      user = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Regional_Admin';
        userType = 'regional';
        userModel = 'RegionalAdmin';
        console.log("✅ User found in RegionalAdmin table");
      }
    }

    // ✅ 4. CHECK ZONE ADMIN
    if (!user) {
      user = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Zone_Admin';
        userType = 'zone';
        userModel = 'ZoneAdmin';
        console.log("✅ User found in ZoneAdmin table");
      }
    }

    // ✅ 5. CHECK WOREDA ADMIN
    if (!user) {
      user = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Woreda_Admin';
        userType = 'woreda';
        userModel = 'WoredaAdmin';
        console.log("✅ User found in WoredaAdmin table");
      }
    }

    // ✅ 6. CHECK KEBELE ADMIN
    if (!user) {
      user = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Kebele_Admin';
        userType = 'kebele';
        userModel = 'KebeleAdmin';
        console.log("✅ User found in KebeleAdmin table");
      }
    }

    // ✅ 7. CHECK HOSPITAL ADMIN
    if (!user) {
      user = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Hospital_Admin';
        userType = 'hospital';
        userModel = 'HospitalAdmin';
        console.log("✅ User found in HospitalAdmin table");
      }
    }

    // ✅ 8. CHECK HOSPITAL STAFF
    if (!user) {
      user = await HospitalStaff.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = user.department || 'staff';
        userType = 'staff';
        userModel = 'HospitalStaff';
        console.log("✅ User found in HospitalStaff table, department:", role);
      }
    }

    // ✅ IF NO USER FOUND IN ANY TABLE
    if (!user) {
      console.log("❌ USER NOT FOUND in any table for email:", normalizedEmail);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check if user is active
    if (user.status && user.status === 'inactive') {
      console.log("❌ Account is inactive for:", normalizedEmail);
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Contact your administrator."
      });
    }

    // ✅ DEVELOPMENT MODE: Auto-verify ALL users
    if (isDevelopment && !user.is_verified) {
      console.log(`✅ Auto-verifying user in development mode: ${normalizedEmail}`);
      user.is_verified = true;
      user.verification_token = null;
      user.verification_token_expires = null;
      await user.save();
    }

    // Check if email is verified
    if (user.is_verified === false) {
      console.log("❌ Email not verified:", normalizedEmail);
      return res.status(403).json({
        success: false,
        message: "Please verify your email address."
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Invalid password for:", normalizedEmail);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    console.log("✅ Login successful for:", normalizedEmail);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        type: userType,
        userType: userType,
        role: role,
        model: userModel
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Prepare user data
    const userData = {
      id: user.id,
      first_name: user.first_name,
      middle_name: user.middle_name || '',
      last_name: user.last_name,
      full_name: `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim(),
      email: user.email,
      role: role,
      userType: userType,
      status: user.status || 'active',
      is_verified: user.is_verified
    };

    // Add location data if exists
    if (user.region_name) userData.region_name = user.region_name;
    if (user.zone_name) userData.zone_name = user.zone_name;
    if (user.woreda_name) userData.woreda_name = user.woreda_name;
    if (user.kebele_name) userData.kebele_name = user.kebele_name;
    if (user.hospital_name) userData.hospital_name = user.hospital_name;
    if (user.department) userData.department = user.department;
    if (user.ward) userData.ward = user.ward;
    if (user.federal_id) userData.federal_id = user.federal_id;
    if (user.regional_id) userData.regional_id = user.regional_id;
    if (user.zone_id) userData.zone_id = user.zone_id;
    if (user.woreda_id) userData.woreda_id = user.woreda_id;
    if (user.kebele_id) userData.kebele_id = user.kebele_id;
    if (user.hospital_id) userData.hospital_id = user.hospital_id;

    // Update last login
    user.last_login = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      user: userData,
      message: "Login successful"
    });

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
};

// ==================== GET PROFILE ====================
export const getProfile = async (req, res) => {
  try {
    const userType = req.user?.type || req.user?.userType;
    const userId = req.user?.id;
    
    if (!userId || !userType) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication"
      });
    }
    
    let user = null;
    
    switch(userType) {
      case 'federal':
        user = await FederalAdmin.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'regional':
        user = await RegionalAdmin.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'zone':
        user = await ZoneAdmin.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'woreda':
        user = await WoredaAdmin.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'kebele':
        user = await KebeleAdmin.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'hospital':
        user = await HospitalAdmin.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      case 'staff':
        user = await HospitalStaff.findByPk(userId, {
          attributes: { exclude: ['password'] }
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Invalid user type: ${userType}`
        });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== REFRESH TOKEN ====================
export const refreshToken = async (req, res) => {
  try {
    const { id, email, type, userType, role } = req.user;
    const tokenType = type || userType;
    
    const newToken = jwt.sign(
      { 
        id, 
        email, 
        type: tokenType,
        userType: tokenType,
        role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    console.error("❌ Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userType = req.user?.type || req.user?.userType;
    const userId = req.user?.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password"
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters"
      });
    }
    
    let user = null;
    
    switch(userType) {
      case 'federal':
        user = await FederalAdmin.findByPk(userId);
        break;
      case 'regional':
        user = await RegionalAdmin.findByPk(userId);
        break;
      case 'zone':
        user = await ZoneAdmin.findByPk(userId);
        break;
      case 'woreda':
        user = await WoredaAdmin.findByPk(userId);
        break;
      case 'kebele':
        user = await KebeleAdmin.findByPk(userId);
        break;
      case 'hospital':
        user = await HospitalAdmin.findByPk(userId);
        break;
      case 'staff':
        user = await HospitalStaff.findByPk(userId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid user type"
        });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.last_password_change = new Date();
    await user.save();
    
    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== FORGOT PASSWORD ====================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("=".repeat(60));
    console.log("🔐 Forgot password request for email:", email);
    console.log("=".repeat(60));

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = null;

    // Search for user in all tables (including User table)
    user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await HospitalStaff.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return res.json({
        success: true,
        message: "If your email is registered, you will receive a reset link"
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000);

    user.reset_password_token = resetToken;
    user.reset_password_expires = resetExpires;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    if (isDevelopment) {
      console.log('\n' + '='.repeat(60));
      console.log(`🔐 PASSWORD RESET LINK (Development Mode):`);
      console.log(`Email: ${normalizedEmail}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        message: `Password reset link created. Please check the server console for the link.`,
        devLink: resetUrl
      });
    }

    try {
      await sendResetPasswordEmail(normalizedEmail, user.first_name, resetToken);
      res.json({
        success: true,
        message: "Password reset link sent to your email"
      });
    } catch (emailError) {
      console.error("❌ Email send error:", emailError);
      console.log(`Reset link for ${normalizedEmail}: ${resetUrl}`);
      res.json({
        success: true,
        message: "Password reset link created. Please check your email or contact support."
      });
    }

  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

// ==================== RESET PASSWORD ====================
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and new password"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    let user = null;

    user = await User.findOne({ 
      where: { 
        reset_password_token: token,
        reset_password_expires: { [Op.gt]: new Date() }
      }
    });
    if (!user) {
      user = await FederalAdmin.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await RegionalAdmin.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await ZoneAdmin.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await WoredaAdmin.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await KebeleAdmin.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await HospitalAdmin.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await HospitalStaff.findOne({ 
        where: { 
          reset_password_token: token,
          reset_password_expires: { [Op.gt]: new Date() }
        }
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link. Please request a new one."
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.reset_password_token = null;
    user.reset_password_expires = null;
    user.last_password_change = new Date();
    await user.save();

    console.log("✅ Password reset successfully for:", user.email);

    res.json({
      success: true,
      message: "Password has been reset successfully! Please login with your new password."
    });

  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

// ==================== RESEND VERIFICATION EMAIL ====================
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("=".repeat(60));
    console.log("📧 Resend verification email request for:", email);
    console.log("=".repeat(60));

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = null;

    user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await HospitalStaff.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      console.log("❌ User not found with email:", normalizedEmail);
      return res.status(404).json({
        success: false,
        message: "User not found with this email"
      });
    }

    if (isDevelopment) {
      console.log(`✅ Auto-verifying user in development mode: ${normalizedEmail}`);
      user.is_verified = true;
      user.verification_token = null;
      user.verification_token_expires = null;
      await user.save();
      
      return res.json({
        success: true,
        message: "Development mode: Email auto-verified. You can now login."
      });
    }

    if (user.is_verified === true) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. You can login."
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 86400000);

    user.verification_token = verificationToken;
    user.verification_token_expires = tokenExpires;
    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

    if (isDevelopment) {
      console.log('\n' + '='.repeat(60));
      console.log(`📧 VERIFICATION LINK (Development Mode):`);
      console.log(`Email: ${normalizedEmail}`);
      console.log(`Verify URL: ${verifyUrl}`);
      console.log('='.repeat(60) + '\n');
    }

    try {
      await sendVerificationEmail(normalizedEmail, user.first_name, verificationToken);
      console.log("✅ Verification email sent to:", normalizedEmail);
      res.json({
        success: true,
        message: "Verification email has been sent. Please check your inbox."
      });
    } catch (emailError) {
      console.error("❌ Email send error:", emailError);
      res.json({
        success: true,
        message: `Verification link: ${verifyUrl} (Check console if email fails)`,
        devLink: verifyUrl
      });
    }

  } catch (error) {
    console.error("❌ Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

// ==================== VERIFY EMAIL ====================
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    console.log("=".repeat(60));
    console.log("📧 Verify email request for token:", token?.substring(0, 20) + "...");
    console.log("=".repeat(60));

    let user = null;

    user = await User.findOne({ 
      where: { 
        verification_token: token,
        verification_token_expires: { [Op.gt]: new Date() }
      }
    });
    
    if (!user) {
      user = await FederalAdmin.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await RegionalAdmin.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await ZoneAdmin.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await WoredaAdmin.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await KebeleAdmin.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await HospitalAdmin.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }
    if (!user) {
      user = await HospitalStaff.findOne({ 
        where: { 
          verification_token: token,
          verification_token_expires: { [Op.gt]: new Date() }
        }
      });
    }

    if (!user) {
      console.log("❌ Invalid or expired token");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link"
      });
    }

    console.log("✅ User found for verification:", user.email);

    user.is_verified = true;
    user.verification_token = null;
    user.verification_token_expires = null;
    await user.save();

    console.log("✅ Email verified for:", user.email);

    res.json({
      success: true,
      message: "Email verified successfully! You can now login."
    });

  } catch (error) {
    console.error("❌ Verify email error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

// ==================== SET PASSWORD ====================
export const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("=".repeat(60));
    console.log("🔐 Set password request for email:", email);
    console.log("=".repeat(60));

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = null;

    user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
    if (!user) user = await HospitalStaff.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (isDevelopment && !user.is_verified) {
      user.is_verified = true;
    }

    if (!user.is_verified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email first"
      });
    }

    if (user.password && user.password !== '') {
      return res.status(400).json({
        success: false,
        message: "Password already set. Please use forgot password to reset."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.last_password_change = new Date();
    await user.save();

    console.log("✅ Password set successfully for:", normalizedEmail);

    res.json({
      success: true,
      message: "Password set successfully! You can now login."
    });

  } catch (error) {
    console.error("❌ Set password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};

// ==================== LOGOUT ====================
export const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout"
    });
  }
};

// ==================== CREATE ADMIN WITH DUPLICATE CHECK (NEW) ====================
export const createAdmin = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      adminType,
      first_name, 
      last_name,
      middle_name,
      region_name,
      zone_name,
      woreda_name,
      kebele_name,
      hospital_name,
      department,
      phone,
      gender,
      age,
      ...otherData 
    } = req.body;

    console.log("=".repeat(60));
    console.log("📝 Create Admin Request:");
    console.log("Email:", email);
    console.log("Type:", adminType);
    console.log("=".repeat(60));

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ CRITICAL: Check if email exists in ANY table
    const emailCheck = await checkEmailInAllTables(normalizedEmail);
    
    if (emailCheck.exists) {
      console.log(`❌ DUPLICATE EMAIL: ${normalizedEmail} already exists in ${emailCheck.table}`);
      
      return res.status(409).json({
        success: false,
        message: `Email "${email}" is already registered as a ${emailCheck.table}. Please use a different email address.`,
        existingTable: emailCheck.table
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 86400000);

    let newAdmin = null;
    let responseType = adminType;

    // Create based on admin type
    switch(adminType) {
      case 'federal':
        newAdmin = await FederalAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'federal';
        break;

      case 'regional':
        if (!region_name) {
          return res.status(400).json({
            success: false,
            message: "region_name is required for Regional Admin"
          });
        }
        newAdmin = await RegionalAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          region_name: region_name,
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'regional';
        break;

      case 'zone':
        if (!region_name || !zone_name) {
          return res.status(400).json({
            success: false,
            message: "region_name and zone_name are required for Zone Admin"
          });
        }
        newAdmin = await ZoneAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          region_name: region_name,
          zone_name: zone_name,
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'zone';
        break;

      case 'woreda':
        if (!region_name || !zone_name || !woreda_name) {
          return res.status(400).json({
            success: false,
            message: "region_name, zone_name, and woreda_name are required for Woreda Admin"
          });
        }
        newAdmin = await WoredaAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          region_name: region_name,
          zone_name: zone_name,
          woreda_name: woreda_name,
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'woreda';
        break;

      case 'kebele':
        if (!region_name || !zone_name || !woreda_name || !kebele_name) {
          return res.status(400).json({
            success: false,
            message: "region_name, zone_name, woreda_name, and kebele_name are required for Kebele Admin"
          });
        }
        newAdmin = await KebeleAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          region_name: region_name,
          zone_name: zone_name,
          woreda_name: woreda_name,
          kebele_name: kebele_name,
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'kebele';
        break;

      case 'hospital':
        if (!hospital_name) {
          return res.status(400).json({
            success: false,
            message: "hospital_name is required for Hospital Admin"
          });
        }
        newAdmin = await HospitalAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          hospital_name: hospital_name,
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'hospital';
        break;

      case 'staff':
        if (!hospital_name || !department) {
          return res.status(400).json({
            success: false,
            message: "hospital_name and department are required for Hospital Staff"
          });
        }
        newAdmin = await HospitalStaff.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          hospital_name: hospital_name,
          department: department,
          phone: phone || null,
          gender: gender || null,
          age: age || null,
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        responseType = 'staff';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Invalid admin type: ${adminType}. Valid types: federal, regional, zone, woreda, kebele, hospital, staff`
        });
    }

    console.log(`✅ ${adminType} admin created successfully:`, normalizedEmail);

    // Send verification email in production
    if (!isDevelopment && newAdmin) {
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;
      try {
        await sendVerificationEmail(normalizedEmail, first_name, verificationToken);
        console.log("📧 Verification email sent to:", normalizedEmail);
      } catch (emailError) {
        console.error("Email send error:", emailError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: `${responseType} admin created successfully! ${isDevelopment ? 'Auto-verified in development mode.' : 'Verification email sent.'}`,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: `${first_name} ${last_name}`,
        type: responseType,
        is_verified: newAdmin.is_verified
      }
    });

  } catch (error) {
    console.error("❌ Create admin error:", error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: "Email already exists in this table. Please use a different email."
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error while creating admin",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== CHECK EMAIL AVAILABILITY ====================
export const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }
    
    const result = await checkEmailInAllTables(email);
    
    res.json({
      success: true,
      available: !result.exists,
      exists: result.exists,
      existingTable: result.table,
      message: result.exists 
        ? `Email is already used by ${result.table}` 
        : "Email is available"
    });
  } catch (error) {
    console.error("Check email error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking email availability"
    });
  }
};