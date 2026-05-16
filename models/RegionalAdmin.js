import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";

const RegionalAdmin = sequelize.define("RegionalAdmin", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Foreign key to Federal Admin
  federal_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "federal_admins",
      key: "id"
    }
  },
  // Region information
  region_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
 
  // Personal information (matching FederalAdmin)
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
    type: DataTypes.ENUM("Male", "Female", "Other"),
    allowNull: false
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false
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
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: "Regional_Admin"
  },
  // Status field (optional but useful)
  status: {
    type: DataTypes.ENUM("active", "inactive"),
    defaultValue: "active"
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
  tableName: "regional_admins",
  timestamps: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(admin.password, salt);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(admin.password, salt);
      }
    }
  }
});

export default RegionalAdmin;