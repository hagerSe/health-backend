import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";

const ZoneAdmin = sequelize.define("ZoneAdmin", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  regional_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "regional_admins",
      key: "id"
    }
  },
  zone_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
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
    unique: true,
    validate: {
      isEmail: true
    }
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
    defaultValue: "Zone_Admin"
  },
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
  tableName: "zone_admins",
  timestamps: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        console.log(`🔐 Hashing password for new zone admin: ${admin.email}`);
        const salt = await bcrypt.genSalt(12);
        admin.password = await bcrypt.hash(admin.password, salt);
        console.log("✅ Password hashed successfully");
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        console.log(`🔐 Hashing updated password for: ${admin.email}`);
        const salt = await bcrypt.genSalt(12);
        admin.password = await bcrypt.hash(admin.password, salt);
        console.log("✅ Password updated and hashed");
      }
    }
  }
});

// Add a method to compare passwords
ZoneAdmin.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default ZoneAdmin;