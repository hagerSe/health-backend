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

// ==================== VALIDATION HELPER FUNCTIONS ====================

// 1. Validate Email Format - Accepts all valid email formats
const validateEmail = (email) => {
  if (!email) {
    return { valid: false, message: "Email is required" };
  }
  
  const trimmedEmail = email.trim();
  
  // Check for spaces FIRST
  if (trimmedEmail.includes(' ')) {
    return { valid: false, message: "Email cannot contain spaces" };
  }
  
  // Must contain @
  if (!trimmedEmail.includes('@')) {
    return { valid: false, message: "Email must contain @ symbol" };
  }
  
  // Standard email regex that accepts all valid TLDs (.com, .org, .net, .gov.et, .et, etc.)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    return { 
      valid: false, 
      message: "Invalid email format. Valid examples: name@gmail.com, admin@health.gov.et, user@company.org" 
    };
  }
  
  // Check email length
  if (trimmedEmail.length < 5) {
    return { valid: false, message: "Email is too short" };
  }
  
  if (trimmedEmail.length > 100) {
    return { valid: false, message: "Email must be less than 100 characters" };
  }
  
  // Check for consecutive dots
  if (trimmedEmail.includes('..')) {
    return { valid: false, message: "Email cannot contain consecutive dots" };
  }
  
  return { valid: true, message: "Email format is valid" };
};

// 2. Validate Name (Only letters, spaces, hyphens - NO numbers)
const validateName = (name, fieldName) => {
  if (!name || name.trim() === '') {
    return { valid: false, message: `${fieldName} is required` };
  }
  
  const trimmedName = name.trim();
  
  // Only letters, spaces, hyphens, and apostrophes allowed - NO NUMBERS
  const nameRegex = /^[A-Za-z\s\-']+$/;
  
  if (!nameRegex.test(trimmedName)) {
    return { 
      valid: false, 
      message: `${fieldName} must contain only letters (A-Z, a-z). Numbers and special characters are not allowed.` 
    };
  }
  
  if (trimmedName.length < 2) {
    return { valid: false, message: `${fieldName} must be at least 2 characters long` };
  }
  
  if (trimmedName.length > 50) {
    return { valid: false, message: `${fieldName} must be less than 50 characters` };
  }
  
  return { valid: true, message: `${fieldName} is valid` };
};

// 3. Validate Phone Number - Max 14 digits, accepts any country format
const validatePhone = (phone) => {
  if (!phone) {
    return { valid: true, message: "Phone is optional" };
  }
  
  // Convert to string and clean (remove spaces, dashes, parentheses, plus sign)
  const phoneStr = String(phone);
  const cleanedPhone = phoneStr.replace(/[\s\-\(\)\+]/g, '');
  
  // Check if contains only numbers after cleaning
  if (!/^\d+$/.test(cleanedPhone)) {
    return { 
      valid: false, 
      message: "Phone number must contain only digits, spaces, dashes, parentheses, or plus sign" 
    };
  }
  
  // Length validation: minimum 10 digits, maximum 14 digits
  if (cleanedPhone.length < 10) {
    return { 
      valid: false, 
      message: "Phone number must be at least 10 digits" 
    };
  }
  
  if (cleanedPhone.length > 14) {
    return { 
      valid: false, 
      message: "Phone number must not exceed 14 digits" 
    };
  }
  
  return { valid: true, message: "Phone number is valid" };
};

// 4. Validate Age
const validateAge = (age) => {
  if (!age && age !== 0) {
    return { valid: false, message: "Age is required" };
  }
  
  const ageNum = parseInt(age);
  
  if (isNaN(ageNum)) {
    return { valid: false, message: "Age must be a number" };
  }
  
  if (ageNum < 18) {
    return { valid: false, message: "Age must be at least 18 years old" };
  }
  
  if (ageNum > 100) {
    return { valid: false, message: "Age must be less than 100 years old" };
  }
  
  return { valid: true, message: "Age is valid" };
};

// 5. Validate Password
const validatePassword = (password) => {
  if (!password) {
    return { valid: false, message: "Password is required" };
  }
  
  if (password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters long" };
  }
  
  if (password.length > 50) {
    return { valid: false, message: "Password must be less than 50 characters" };
  }
  
  return { valid: true, message: "Password is valid" };
};

// 6. Validate Gender
const validateGender = (gender) => {
  if (!gender) {
    return { valid: false, message: "Gender is required" };
  }
  
  const validGenders = ['Male', 'Female', 'Other'];
  
  if (!validGenders.includes(gender)) {
    return { valid: false, message: "Gender must be Male, Female, or Other" };
  }
  
  return { valid: true, message: "Gender is valid" };
};

// ==================== HELPER: CHECK EMAIL IN ALL TABLES ====================
const checkEmailInAllTables = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  
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

// ==================== LOGIN FUNCTION ====================
// ==================== LOGIN FUNCTION - COMPLETELY FIXED ====================
// ==================== LOGIN FUNCTION - FIXED ====================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("=".repeat(60));
    console.log("🔐 Login attempt");
    console.log("Email:", email);
    console.log("=".repeat(60));

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Clean and normalize email
    const normalizedEmail = String(email).toLowerCase().trim();
    const cleanPassword = String(password);

    let user = null;
    let role = null;
    let userType = null;
    let userModel = null;

    // Search for user in ALL tables
    // Hospital Staff (most common for your users)
    user = await HospitalStaff.findOne({ where: { email: normalizedEmail } });
    if (user) {
      role = user.department || 'staff';
      userType = 'staff';
      userModel = 'HospitalStaff';
      console.log("Found in HospitalStaff table");
      console.log("Department:", user.department);
      console.log("Hospital ID:", user.hospital_id);
    }

    // Federal Admin
    if (!user) {
      user = await FederalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Federal_Admin';
        userType = 'federal';
        userModel = 'FederalAdmin';
        console.log("Found in FederalAdmin table");
      }
    }

    // Regional Admin
    if (!user) {
      user = await RegionalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Regional_Admin';
        userType = 'regional';
        userModel = 'RegionalAdmin';
        console.log("Found in RegionalAdmin table");
      }
    }

    // Zone Admin
    if (!user) {
      user = await ZoneAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Zone_Admin';
        userType = 'zone';
        userModel = 'ZoneAdmin';
        console.log("Found in ZoneAdmin table");
      }
    }

    // Woreda Admin
    if (!user) {
      user = await WoredaAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Woreda_Admin';
        userType = 'woreda';
        userModel = 'WoredaAdmin';
        console.log("Found in WoredaAdmin table");
      }
    }

    // Kebele Admin
    if (!user) {
      user = await KebeleAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Kebele_Admin';
        userType = 'kebele';
        userModel = 'KebeleAdmin';
        console.log("Found in KebeleAdmin table");
      }
    }

    // Hospital Admin
    if (!user) {
      user = await HospitalAdmin.findOne({ where: { email: normalizedEmail } });
      if (user) {
        role = 'Hospital_Admin';
        userType = 'hospital';
        userModel = 'HospitalAdmin';
        console.log("Found in HospitalAdmin table");
      }
    }

    // User not found
    if (!user) {
      console.log("❌ User not found in any table");
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    console.log("✅ User found");
    console.log("User ID:", user.id);
    console.log("Is Verified:", user.is_verified);

    // Check if account is active
    if (user.status && user.status === 'inactive') {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Contact your administrator."
      });
    }

    // Auto-verify in development mode
    if (isDevelopment && !user.is_verified) {
      console.log("🔓 Auto-verifying user (development mode)");
      user.is_verified = true;
      user.verification_token = null;
      user.verification_token_expires = null;
      await user.save();
    }

    // Check if email is verified
    if (user.is_verified === false) {
      console.log("❌ Email not verified");
      return res.status(403).json({
        success: false,
        message: "Please verify your email address."
      });
    }

    // Password verification
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(cleanPassword, user.password);
      console.log("Password match:", isMatch);
      
      if (!isMatch && user.password === cleanPassword) {
        console.log("Plain text password match detected!");
        isMatch = true;
        const newHash = await bcrypt.hash(cleanPassword, 10);
        user.password = newHash;
        await user.save();
      }
    } catch (bcryptError) {
      console.error("bcrypt error:", bcryptError.message);
      isMatch = (user.password === cleanPassword);
    }
    
    if (!isMatch) {
      console.log("❌ Password verification FAILED");
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    console.log("✅ Password verified successfully!");

    // ✅ FIXED: Generate JWT token with hospital_id
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        type: userType,
        userType: userType,
        role: role,
        department: user.department,
        hospital_id: user.hospital_id  // ✅ CRITICAL: Include this
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log("✅ JWT token generated with hospital_id:", user.hospital_id);

    // ✅ FIXED: Prepare user data for response WITH hospital_id
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
      is_verified: user.is_verified,
      // ✅ CRITICAL: Add hospital_id
      hospital_id: user.hospital_id,
      hospitalId: user.hospital_id,  // Also add as hospitalId for compatibility
      department: user.department,
      ward: user.ward
    };

    // Add optional fields if they exist
    if (user.hospital_name) userData.hospital_name = user.hospital_name;
    if (user.phone) userData.phone = user.phone;
    if (user.gender) userData.gender = user.gender;
    if (user.age) userData.age = user.age;

    console.log("✅ userData prepared with hospital_id:", userData.hospital_id);
    console.log("=".repeat(60));
    console.log(`✅ LOGIN SUCCESSFUL for: ${normalizedEmail} (${userType})`);
    console.log(`✅ Hospital ID: ${user.hospital_id}`);
    console.log("=".repeat(60));

    // Update last login time
    user.last_login = new Date();
    await user.save();

    // Send success response
    res.json({
      success: true,
      token,
      user: userData,
      message: "Login successful"
    });

  } catch (error) {
    console.error("❌ Login error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login. Please try again." 
    });
  }
};
// ==================== CREATE ADMIN WITH COMPLETE VALIDATION ====================
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

    // ==================== VALIDATION ====================
    
    // 1. Email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message,
        field: "email"
      });
    }

    // 2. First Name (letters only)
    const firstNameValidation = validateName(first_name, "First name");
    if (!firstNameValidation.valid) {
      return res.status(400).json({
        success: false,
        message: firstNameValidation.message,
        field: "first_name"
      });
    }

    // 3. Last Name (letters only)
    const lastNameValidation = validateName(last_name, "Last name");
    if (!lastNameValidation.valid) {
      return res.status(400).json({
        success: false,
        message: lastNameValidation.message,
        field: "last_name"
      });
    }

    // 4. Middle Name (optional)
    if (middle_name && middle_name.trim() !== '') {
      const middleNameValidation = validateName(middle_name, "Middle name");
      if (!middleNameValidation.valid) {
        return res.status(400).json({
          success: false,
          message: middleNameValidation.message,
          field: "middle_name"
        });
      }
    }

    // 5. Password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message,
        field: "password"
      });
    }

    // 6. Phone
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message,
        field: "phone"
      });
    }

    // 7. Age
    const ageValidation = validateAge(age);
    if (!ageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: ageValidation.message,
        field: "age"
      });
    }

    // 8. Gender
    const genderValidation = validateGender(gender);
    if (!genderValidation.valid) {
      return res.status(400).json({
        success: false,
        message: genderValidation.message,
        field: "gender"
      });
    }

    // 9. Admin Type
    const validAdminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital', 'staff'];
    if (!adminType || !validAdminTypes.includes(adminType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid admin type. Must be one of: ${validAdminTypes.join(', ')}`,
        field: "adminType"
      });
    }

    // 10. Check duplicate email
    const normalizedEmail = email.toLowerCase().trim();
    const emailCheck = await checkEmailInAllTables(normalizedEmail);
    
    if (emailCheck.exists) {
      return res.status(409).json({
        success: false,
        message: `Email "${email}" is already registered as a ${emailCheck.table}. Please use a different email address.`,
        existingTable: emailCheck.table
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 86400000);

    let newAdmin = null;
    let responseType = adminType;

    switch(adminType.toLowerCase()) {
      case 'federal':
        newAdmin = await FederalAdmin.create({
          email: normalizedEmail,
          password: hashedPassword,
          first_name: first_name,
          last_name: last_name,
          middle_name: middle_name || '',
          phone: phone || null,
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      case 'regional':
        if (!region_name) {
          return res.status(400).json({
            success: false,
            message: "region_name is required for Regional Admin",
            field: "region_name"
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
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      case 'zone':
        if (!region_name || !zone_name) {
          return res.status(400).json({
            success: false,
            message: "region_name and zone_name are required for Zone Admin",
            field: "location"
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
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      case 'woreda':
        if (!region_name || !zone_name || !woreda_name) {
          return res.status(400).json({
            success: false,
            message: "region_name, zone_name, and woreda_name are required for Woreda Admin",
            field: "location"
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
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      case 'kebele':
        if (!region_name || !zone_name || !woreda_name || !kebele_name) {
          return res.status(400).json({
            success: false,
            message: "region_name, zone_name, woreda_name, and kebele_name are required for Kebele Admin",
            field: "location"
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
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      case 'hospital':
        if (!hospital_name) {
          return res.status(400).json({
            success: false,
            message: "hospital_name is required for Hospital Admin",
            field: "hospital_name"
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
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      case 'staff':
        if (!hospital_name || !department) {
          return res.status(400).json({
            success: false,
            message: "hospital_name and department are required for Hospital Staff",
            field: "staff_info"
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
          gender: gender,
          age: parseInt(age),
          is_verified: isDevelopment ? true : false,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires,
          status: 'active',
          ...otherData
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Invalid admin type: ${adminType}`
        });
    }

    console.log(`✅ ${adminType} admin created successfully:`, normalizedEmail);

    if (!isDevelopment && newAdmin) {
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;
      try {
        await sendVerificationEmail(normalizedEmail, first_name, verificationToken);
      } catch (emailError) {
        console.error("Email send error:", emailError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: `${responseType} admin created successfully! ${isDevelopment ? 'Auto-verified.' : 'Verification email sent.'}`,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        first_name: newAdmin.first_name,
        last_name: newAdmin.last_name,
        type: responseType,
        is_verified: newAdmin.is_verified
      }
    });

  } catch (error) {
    console.error("❌ Create admin error:", error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: "Email already exists. Please use a different email."
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
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message,
        field: "email"
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
    
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
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

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address"
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message
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

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
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

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address"
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message
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
        message: "User not found with this email"
      });
    }

    if (isDevelopment) {
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
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link"
      });
    }

    user.is_verified = true;
    user.verification_token = null;
    user.verification_token_expires = null;
    await user.save();

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

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
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