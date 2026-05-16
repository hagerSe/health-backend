import { DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";

const WoredaAdmin = sequelize.define("WoredaAdmin", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Foreign key to Zone Admin
  zone_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "zone_admins",
      key: "id"
    }
  },
  // Woreda information
  woreda_name: {
    type: DataTypes.STRING(100),
    allowNull: false
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
    defaultValue: "Woreda_Admin"
  },
  // Status column for soft delete
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
  tableName: "woreda_admins",
  timestamps: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        console.log(`🔐 Hashing password for new woreda admin: ${admin.email}`);
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

// Password comparison method
WoredaAdmin.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default WoredaAdmin;