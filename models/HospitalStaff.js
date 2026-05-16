import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";

const HospitalStaff = sequelize.define("HospitalStaff", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Foreign key to Hospital
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_admins",
      key: "id"
    }
  },
  // Personal information
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  middle_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  gender: {
    type: DataTypes.ENUM("Male", "Female", "Other"),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  // Department - ALL departments including Pharma, Lab, Radio
  department: {
    type: DataTypes.ENUM(
      "Doctor",
      "Nurse",
      "Pharma",
      "Lab",
      "Radio",
      "Midwife",
      "Triage",
      "Card_Office",
      "Bed_Management",
      "Human_Resource"
    ),
    allowNull: false
  },
  // ✅ Ward field - Required for Doctor, Nurse, Midwife, Pharma, Lab, Radio
  ward: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['OPD', 'EME', 'ANC']]
    },
    comment: 'Ward assignment for staff: OPD, EME, or ANC'
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: "Hospital_Staff"
  },
  // Status field for soft delete
  status: {
    type: DataTypes.STRING(20),
    defaultValue: "active",
    validate: {
      isIn: [['active', 'inactive']]
    }
  },
  // ==================== HR SCHEDULING FIELDS ====================
  max_hours_per_week: {
    type: DataTypes.INTEGER,
    defaultValue: 40,
    comment: "Maximum hours staff can work per week"
  },
  skills: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: "Array of skills (e.g., ['BLS', 'ACLS', 'Ultrasound'])"
  },
  shift_preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      morning: true,
      afternoon: true,
      night: false
    },
    comment: "Staff shift preferences (morning, afternoon, night)"
  },
  total_hours_this_week: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Total hours worked in current week"
  },
  last_shift_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: "Date of last shift worked"
  },
  last_shift_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['morning', 'afternoon', 'night', null]]
    },
    comment: "Type of last shift worked (morning, afternoon, night)"
  },
  qualifications: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: "Array of qualifications/certifications"
  },
  years_of_experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Years of experience"
  },
  preferred_days_off: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: "Array of preferred days off (0-6, where 0 is Sunday)"
  },
  emergency_contact: {
    type: DataTypes.JSONB,
    defaultValue: {
      name: null,
      phone: null,
      relationship: null
    },
    comment: "Emergency contact information"
  },
  available_for_scheduling: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Whether staff is available for scheduling"
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Additional notes about staff"
  },
  // ==================== DOCTOR PROFILE EXTENDED FIELDS ====================
  specialization: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Medical specialization (e.g., Cardiology, Pediatrics)'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Short biography or about section'
  },
  profile_picture: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL to profile picture'
  },
  languages: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Languages spoken by the doctor'
  },
  
  // ========== ADD THESE NEW FIELDS ==========
  // Email Verification Fields
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verification_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  verification_token_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Password Reset Fields
  reset_password_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reset_password_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Last login tracking
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  }
  
}, {
  tableName: "hospital_staff",
  timestamps: true,
  hooks: {
    beforeCreate: async (staff) => {
      if (staff.password) {
        const salt = await bcrypt.genSalt(10);
        staff.password = await bcrypt.hash(staff.password, salt);
      }
    },
    beforeUpdate: async (staff) => {
      if (staff.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        staff.password = await bcrypt.hash(staff.password, salt);
      }
    }
  }
});

// ==================== INSTANCE METHODS ====================

HospitalStaff.prototype.getFullName = function() {
  const firstName = this.first_name || '';
  const middleName = this.middle_name ? ` ${this.middle_name}` : '';
  const lastName = this.last_name || '';
  return `${firstName}${middleName} ${lastName}`.trim();
};

HospitalStaff.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values.full_name = this.getFullName();
  // Remove password from JSON output
  delete values.password;
  return values;
};

HospitalStaff.prototype.isAvailableForShift = function(shiftType, date, existingSchedules) {
  if (this.status !== 'active') return false;
  if (!this.available_for_scheduling) return false;
  if (!this.shift_preferences?.[shiftType]) return false;
  
  const alreadyScheduled = existingSchedules?.some(schedule => 
    schedule.staff_id === this.id && 
    new Date(schedule.date).toDateString() === new Date(date).toDateString()
  );
  if (alreadyScheduled) return false;
  
  if (shiftType !== 'night' && this.last_shift_type === 'night') {
    const lastShiftDate = new Date(this.last_shift_date);
    const currentDate = new Date(date);
    const daysDiff = Math.floor((currentDate - lastShiftDate) / (1000 * 60 * 60 * 24));
    if (daysDiff < 1) return false;
  }
  
  const shiftHours = shiftType === 'night' ? 12 : 6;
  if (this.total_hours_this_week + shiftHours > this.max_hours_per_week) return false;
  
  const dayOfWeek = new Date(date).getDay();
  if (this.preferred_days_off?.includes(dayOfWeek)) return false;
  
  return true;
};

HospitalStaff.prototype.updateShiftStats = async function(shiftType, date) {
  const shiftHours = shiftType === 'night' ? 12 : 6;
  await this.update({
    total_hours_this_week: this.total_hours_this_week + shiftHours,
    last_shift_date: date,
    last_shift_type: shiftType
  });
};

HospitalStaff.prototype.resetWeeklyHours = async function() {
  await this.update({ total_hours_this_week: 0 });
};

// ==================== STATIC METHODS ====================

HospitalStaff.getByDepartment = async function(department, hospitalId) {
  return await this.findAll({
    where: { department, hospital_id: hospitalId, status: 'active' }
  });
};

HospitalStaff.getByWard = async function(ward, hospitalId) {
  return await this.findAll({
    where: { ward, hospital_id: hospitalId, status: 'active' }
  });
};

HospitalStaff.getByRole = async function(role, hospitalId) {
  return await this.findAll({
    where: { role, hospital_id: hospitalId, status: 'active' }
  });
};

HospitalStaff.getAvailableForShift = async function(shiftType, date, ward, hospitalId, excludeStaffIds = []) {
  const { Op } = await import('sequelize');
  const Schedule = sequelize.models.Schedule;
  
  const allStaff = await this.findAll({
    where: {
      ward,
      hospital_id: hospitalId,
      status: 'active',
      available_for_scheduling: true,
      id: { [Op.notIn]: excludeStaffIds }
    }
  });
  
  const existingSchedules = await Schedule.findAll({
    where: { date: new Date(date), hospital_id: hospitalId }
  });
  
  const availableStaff = allStaff.filter(staff => 
    staff.isAvailableForShift(shiftType, date, existingSchedules)
  );
  
  return availableStaff;
};

HospitalStaff.getNearMaxHours = async function(hospitalId, threshold = 5) {
  const { Op } = await import('sequelize');
  return await this.findAll({
    where: {
      hospital_id: hospitalId,
      status: 'active',
      total_hours_this_week: {
        [Op.gte]: sequelize.literal(`max_hours_per_week - ${threshold}`)
      }
    }
  });
};

HospitalStaff.getOnLeaveForDate = async function(date, hospitalId) {
  const { Op } = await import('sequelize');
  const LeaveRequest = sequelize.models.LeaveRequest;
  
  const leaveRequests = await LeaveRequest.findAll({
    where: {
      hospital_id: hospitalId,
      status: 'approved',
      start_date: { [Op.lte]: date },
      end_date: { [Op.gte]: date }
    },
    include: [{ model: this, as: 'staff' }]
  });
  
  return leaveRequests.map(req => req.staff).filter(staff => staff);
};

export default HospitalStaff;