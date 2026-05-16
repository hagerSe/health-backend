import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Bed = sequelize.define("Bed", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // ✅ FIXED: Reference hospital_admins instead of hospitals
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_admins",  // Changed from "hospitals" to "hospital_admins"
      key: "id"
    }
  },
  ward: {
    type: DataTypes.ENUM("OPD", "EME", "ANC"),
    allowNull: false
  },
  number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM("general", "private", "semi-private", "icu", "isolation"),
    defaultValue: "general"
  },
  status: {
    type: DataTypes.ENUM("available", "occupied", "maintenance", "reserved"),
    defaultValue: "available"
  },
  current_patient_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "patients",
      key: "id"
    }
  },
  current_patient_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_cleaned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_occupied_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "beds",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['hospital_id', 'ward', 'number']
    }
  ]
});

export default Bed;