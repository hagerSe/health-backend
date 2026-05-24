import jwt from 'jsonwebtoken';
import HospitalStaff from '../models/HospitalStaff.js';
import FederalAdmin from '../models/FederalAdmin.js';
import RegionalAdmin from '../models/RegionalAdmin.js';
import ZoneAdmin from '../models/ZoneAdmin.js';
import WoredaAdmin from '../models/WoredaAdmin.js';
import KebeleAdmin from '../models/KebeleAdmin.js';
import HospitalAdmin from '../models/HospitalAdmin.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized - No token provided' 
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      console.log('✅ Token verified for user:', decoded.email, 'Type:', decoded.type);
      
      let user = null;
      
      switch(decoded.type) {
        case 'federal':
          user = await FederalAdmin.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        case 'regional':
          user = await RegionalAdmin.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        case 'zone':
          user = await ZoneAdmin.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        case 'woreda':
          user = await WoredaAdmin.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        case 'kebele':
          user = await KebeleAdmin.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        case 'hospital':
          user = await HospitalAdmin.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        case 'staff':
          user = await HospitalStaff.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
          });
          break;
        default:
          console.log('❌ Unknown user type:', decoded.type);
          return res.status(401).json({ 
            success: false, 
            message: 'Invalid user type' 
          });
      }

      if (!user) {
        console.log('❌ User not found for ID:', decoded.id, 'Type:', decoded.type);
        return res.status(401).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      if (user.status && user.status !== 'active') {
        console.log('❌ User account is inactive:', user.email);
        return res.status(401).json({ 
          success: false, 
          message: 'Account is inactive' 
        });
      }

      // ✅ CORRECTED: Added both 'type' and 'userType' properties
      req.user = {
        id: user.id,
        first_name: user.first_name,
        middle_name: user.middle_name || '',
        last_name: user.last_name,
        email: user.email,
        type: decoded.type,           // ← ADDED
        userType: decoded.type,       // ← Keep for compatibility
        role: decoded.role || user.role,
        status: user.status,
        is_verified: user.is_verified,
        // Add department and other fields if they exist
        department: user.department,
        ward: user.ward,
        hospital_name: user.hospital_name,
        region_name: user.region_name,
        zone_name: user.zone_name,
        woreda_name: user.woreda_name,
        kebele_name: user.kebele_name,
        phone: user.phone,
        gender: user.gender,
        age: user.age
      };
      
      console.log('✅ Authentication successful for:', user.email);
      console.log('   User Type:', req.user.userType);
      if (user.department) console.log('   Department:', user.department);
      if (user.ward) console.log('   Ward:', user.ward);
      
      next();
      
    } catch (error) {
      console.log('❌ Token verification error:', error.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized - Invalid token' 
      });
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Enhanced restrictTo function
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    // Admin users have access to everything
    const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
    if (adminTypes.includes(req.user.userType)) {
      console.log('✅ Admin access granted for type:', req.user.userType);
      return next();
    }

    // For staff users, check department and role
    if (req.user.userType === 'staff') {
      const rawDepartment = (req.user.department || '').trim();
      const userRole = (req.user.role || '').toLowerCase();
      
      console.log('🔐 Checking access for department:', rawDepartment, 'role:', userRole);
      console.log('🔐 Required roles:', roles);
      
      const departmentMap = {
        'doctor': ['doctor', 'opd_doctor', 'eme_doctor', 'physician', 'consultant', 'card_office', 'card_office_staff', 'cardofffice'],
        'opd_doctor': ['doctor', 'opd_doctor', 'card_office', 'card_office_staff', 'cardofffice'],
        'eme_doctor': ['doctor', 'eme_doctor', 'card_office', 'card_office_staff', 'cardofffice'],
        'nurse': ['nurse', 'staff_nurse', 'anc_nurse', 'midwife'],
        'anc_nurse': ['nurse', 'anc_nurse', 'midwife'],
        'midwife': ['midwife', 'midwifery', 'anc_midwife', 'nurse_midwife', 'nurse'],
        'anc_midwife': ['midwife', 'anc_midwife', 'midwifery', 'nurse'],
        'triage': ['triage', 'triage_nurse'],
        'triage_nurse': ['triage', 'triage_nurse'],
        'card_office': ['card_office', 'card_office_staff', 'cardofffice', 'doctor'],
        'cardofffice': ['card_office', 'card_office_staff', 'cardofffice', 'doctor'],
        'lab': ['lab', 'lab_technician', 'lab_tech'],
        'lab_technician': ['lab', 'lab_technician'],
        'radiology': ['radiology', 'radiologist', 'radio'],
        'radio': ['radiology', 'radiologist', 'radio'],
        'pharmacy': ['pharmacy', 'pharmacist', 'pharma'],
        'pharma': ['pharmacy', 'pharmacist', 'pharma'],
        'bed_management': ['bed_management', 'bed_manager'],
        'human_resource': ['human_resource', 'hr_staff', 'hr'],
        'hr': ['human_resource', 'hr_staff', 'hr']
      };

      let matchedDepartment = null;
      const deptLower = rawDepartment.toLowerCase();
      
      if (departmentMap[deptLower]) {
        matchedDepartment = deptLower;
      } else {
        for (const [key, values] of Object.entries(departmentMap)) {
          if (values.includes(deptLower) || values.some(v => v.includes(deptLower))) {
            matchedDepartment = key;
            break;
          }
        }
      }

      if (!matchedDepartment) {
        console.log('❌ No department mapping found for:', rawDepartment);
        return res.status(403).json({ 
          success: false, 
          message: 'Department not recognized' 
        });
      }

      const allowedRoles = departmentMap[matchedDepartment] || [];
      
      const hasPermission = roles.some(role => 
        allowedRoles.includes(role) || 
        allowedRoles.includes(role.toLowerCase()) ||
        role === 'staff' ||
        userRole === role ||
        userRole.includes(role)
      );
      
      if (hasPermission) {
        console.log('✅ Permission granted for department:', rawDepartment);
        return next();
      }
      
      console.log('❌ Permission denied. Required:', roles, 'Allowed:', allowedRoles);
    }

    return res.status(403).json({ 
      success: false, 
      message: `You do not have permission to access this resource. Required: ${roles.join(', ')}` 
    });
  };
};

// Helper function to check specific ward access
export const restrictToWard = (ward) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
    if (adminTypes.includes(req.user.userType)) {
      return next();
    }

    if (req.user.ward !== ward) {
      return res.status(403).json({ 
        success: false, 
        message: `You can only access ${req.user.ward} ward data` 
      });
    }

    next();
  };
};

// Helper function to check if user is a doctor
export const isDoctor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized' 
    });
  }

  const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
  if (adminTypes.includes(req.user.userType)) {
    return next();
  }

  if (req.user.userType === 'staff' && 
      req.user.department && 
      req.user.department.toLowerCase().includes('doctor')) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Doctor access required' 
  });
};

// Helper function to check if user is lab staff
export const isLabStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized' 
    });
  }

  const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
  if (adminTypes.includes(req.user.userType)) {
    return next();
  }

  if (req.user.userType === 'staff' && 
      req.user.department && 
      (req.user.department.toLowerCase().includes('lab') || 
       req.user.department.toLowerCase().includes('laboratory'))) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Lab staff access required' 
  });
};

// Helper function to check if user is radiology staff
export const isRadiologyStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized' 
    });
  }

  const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
  if (adminTypes.includes(req.user.userType)) {
    return next();
  }

  if (req.user.userType === 'staff' && 
      req.user.department && 
      (req.user.department.toLowerCase().includes('radiology') || 
       req.user.department.toLowerCase().includes('radio'))) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Radiology staff access required' 
  });
};

// Helper function to check if user is pharmacy staff
export const isPharmacyStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized' 
    });
  }

  const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
  if (adminTypes.includes(req.user.userType)) {
    return next();
  }

  if (req.user.userType === 'staff' && 
      req.user.department && 
      (req.user.department.toLowerCase().includes('pharmacy') || 
       req.user.department.toLowerCase().includes('pharma'))) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Pharmacy staff access required' 
  });
};

// Helper function to check if user is a midwife
export const isMidwife = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized' 
    });
  }

  const adminTypes = ['federal', 'regional', 'zone', 'woreda', 'kebele', 'hospital'];
  if (adminTypes.includes(req.user.userType)) {
    console.log('✅ Admin access granted for midwife route');
    return next();
  }

  if (req.user.userType === 'staff') {
    const department = (req.user.department || '').toLowerCase();
    const ward = (req.user.ward || '').toLowerCase();
    const role = (req.user.role || '').toLowerCase();
    
    if (department.includes('midwife') || 
        department.includes('midwifery') ||
        ward === 'anc' ||
        role === 'midwife' ||
        role.includes('midwife')) {
      console.log('✅ Midwife access granted');
      return next();
    }
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Midwife access required. Only midwives can access ANC services.' 
  });
};