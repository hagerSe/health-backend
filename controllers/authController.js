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

// ==================== LOGIN FUNCTION - WORKS FOR ANY EMAIL ====================
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

    // Check all admin types
    user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
    if (user) {
      role = 'Federal_Admin';
      userType = 'federal';
      userModel = 'FederalAdmin';
    }

    if (!user) {
      user = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Regional_Admin';
        userType = 'regional';
        userModel = 'RegionalAdmin';
      }
    }

    if (!user) {
      user = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Zone_Admin';
        userType = 'zone';
        userModel = 'ZoneAdmin';
      }
    }

    if (!user) {
      user = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Woreda_Admin';
        userType = 'woreda';
        userModel = 'WoredaAdmin';
      }
    }

    if (!user) {
      user = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Kebele_Admin';
        userType = 'kebele';
        userModel = 'KebeleAdmin';
      }
    }

    if (!user) {
      user = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Hospital_Admin';
        userType = 'hospital';
        userModel = 'HospitalAdmin';
      }
    }

    if (!user) {
      user = await HospitalStaff.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = user.department;
        userType = 'staff';
        userModel = 'HospitalStaff';
      }
    }

    if (!user) {
      console.log("❌ USER NOT FOUND");
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check if user is active
    if (user.status && user.status === 'inactive') {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Contact your administrator."
      });
    }

    // ✅ DEVELOPMENT MODE: Auto-verify ALL users (bypass email verification)
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
        message: "Please verify your email address. In development mode, please contact admin."
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
      { expiresIn: '24h' }
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

// ==================== FORGOT PASSWORD - WORKS FOR ANY EMAIL ====================
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

    // Search for user in all tables
    user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
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

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    user.reset_password_token = resetToken;
    user.reset_password_expires = resetExpires;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    // ✅ DEVELOPMENT MODE: Log the reset link (since Resend only works with one email)
    if (isDevelopment) {
      console.log('\n' + '='.repeat(60));
      console.log(`🔐 PASSWORD RESET LINK (Development Mode):`);
      console.log(`Email: ${normalizedEmail}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log(`⚠️ Copy this link and paste in your browser to reset password`);
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        message: `Password reset link created. For development, please check the server console for the link.`,
        devLink: resetUrl // Only in development - helps testing
      });
    }

    // In production, try to send email
    try {
      await sendResetPasswordEmail(normalizedEmail, user.first_name, resetToken);
      res.json({
        success: true,
        message: "Password reset link sent to your email"
      });
    } catch (emailError) {
      console.error("❌ Email send error:", emailError);
      // Still return success but log the link
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

    // Search for user with valid reset token
    user = await FederalAdmin.findOne({ 
      where: { 
        reset_password_token: token,
        reset_password_expires: { [Op.gt]: new Date() }
      }
    });
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear tokens
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

    // Check all tables
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

    // ✅ DEVELOPMENT MODE: Auto-verify any user
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

    // Check if already verified
    if (user.is_verified === true) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. You can login."
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 86400000); // 24 hours

    user.verification_token = verificationToken;
    user.verification_token_expires = tokenExpires;
    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

    // Development: Log the link
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

    // Search for user with valid token
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

    // Mark email as verified
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

// ==================== SET PASSWORD (First time login) ====================
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

    // Find user in all tables
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

    // ✅ DEVELOPMENT MODE: Auto-verify
    if (isDevelopment && !user.is_verified) {
      user.is_verified = true;
    }

    // Check if email is verified
    if (!user.is_verified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email first"
      });
    }

    // Check if password already set
    if (user.password && user.password !== '') {
      return res.status(400).json({
        success: false,
        message: "Password already set. Please use forgot password to reset."
      });
    }

    // Hash and set new password
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