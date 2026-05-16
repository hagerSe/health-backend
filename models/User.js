import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // ==================== PERSONAL INFORMATION ====================
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
  gender: {
    type: DataTypes.STRING(10),  // ← Changed from ENUM
    allowNull: true
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  
  // ==================== ROLE MANAGEMENT ====================
  role: {
    type: DataTypes.STRING(50),  // ← Changed from ENUM
    defaultValue: 'staff',
    allowNull: false
  },
  
  // ==================== HIERARCHY LEVELS ====================
  federal_id: { type: DataTypes.INTEGER, allowNull: true },
  federal_name: { type: DataTypes.STRING(100), allowNull: true },
  region_id: { type: DataTypes.INTEGER, allowNull: true },
  region_name: { type: DataTypes.STRING(100), allowNull: true },
  zone_id: { type: DataTypes.INTEGER, allowNull: true },
  zone_name: { type: DataTypes.STRING(100), allowNull: true },
  woreda_id: { type: DataTypes.INTEGER, allowNull: true },
  woreda_name: { type: DataTypes.STRING(100), allowNull: true },
  kebele_id: { type: DataTypes.INTEGER, allowNull: true },
  kebele_name: { type: DataTypes.STRING(100), allowNull: true },
  hospital_id: { type: DataTypes.INTEGER, allowNull: true },
  hospital_name: { type: DataTypes.STRING(200), allowNull: true },
  service_type: { type: DataTypes.STRING(20), defaultValue: "Public" },  // ← Changed from ENUM
  hospital_type: { type: DataTypes.STRING(50), allowNull: true },  // ← Changed from ENUM
  address: { type: DataTypes.TEXT, allowNull: true },
  website: { type: DataTypes.STRING(200), allowNull: true },
  established_year: { type: DataTypes.INTEGER, allowNull: true },
  bed_capacity: { type: DataTypes.INTEGER, allowNull: true },
  accreditation: { type: DataTypes.STRING(100), allowNull: true },
  
  // ==================== STAFF SPECIFIC FIELDS ====================
  department: { type: DataTypes.STRING(50), allowNull: true },  // ← Changed from ENUM
  ward: { type: DataTypes.STRING(50), allowNull: true },  // ← Changed from ENUM
  employee_id: { type: DataTypes.STRING(50), allowNull: true, unique: true },
  specialization: { type: DataTypes.STRING(100), allowNull: true },
  bio: { type: DataTypes.TEXT, allowNull: true },
  profile_picture: { type: DataTypes.STRING(500), allowNull: true },
  languages: { type: DataTypes.JSONB, defaultValue: [] },
  
  // ==================== HR SCHEDULING FIELDS ====================
  max_hours_per_week: { type: DataTypes.INTEGER, defaultValue: 40 },
  skills: { type: DataTypes.JSONB, defaultValue: [] },
  shift_preferences: { type: DataTypes.JSONB, defaultValue: { morning: true, afternoon: true, night: false } },
  total_hours_this_week: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_shift_date: { type: DataTypes.DATEONLY, allowNull: true },
  last_shift_type: { type: DataTypes.STRING(20), allowNull: true },  // ← Changed from ENUM
  qualifications: { type: DataTypes.JSONB, defaultValue: [] },
  years_of_experience: { type: DataTypes.INTEGER, defaultValue: 0 },
  preferred_days_off: { type: DataTypes.JSONB, defaultValue: [] },
  emergency_contact: { type: DataTypes.JSONB, defaultValue: { name: null, phone: null, relationship: null } },
  available_for_scheduling: { type: DataTypes.BOOLEAN, defaultValue: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  
  // ==================== ACCOUNT STATUS ====================
  status: { type: DataTypes.STRING(20), defaultValue: "active" },  // ← Changed from ENUM
  is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  
  // ==================== TOKENS ====================
  verification_token: { type: DataTypes.TEXT, allowNull: true },
  verification_token_expires: { type: DataTypes.DATE, allowNull: true },
  reset_password_token: { type: DataTypes.TEXT, allowNull: true },
  reset_password_expires: { type: DataTypes.DATE, allowNull: true },
  
  // ==================== TIMESTAMPS ====================
  last_login: { type: DataTypes.DATE, allowNull: true },
  last_password_change: { type: DataTypes.DATE, allowNull: true }
  
}, {
  tableName: "users",
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['hospital_id'] },
    { fields: ['department'] },
    { fields: ['is_verified'] }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance methods
User.prototype.getFullName = function() {
  return `${this.first_name} ${this.middle_name ? this.middle_name + ' ' : ''}${this.last_name}`.trim();
};

User.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default User;