import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Referral = sequelize.define("Referral", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "patients",
      key: "id"
    }
  },
  patient_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  referring_doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  referring_doctor_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  from_ward: {
    type: DataTypes.STRING,
    allowNull: false
  },
  referral_type: {
    type: DataTypes.ENUM("internal", "external"),
    allowNull: false
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  clinical_summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  prescriptions: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  lab_results: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  radiology_results: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM("pending", "accepted", "completed", "rejected"),
    defaultValue: "pending"
  },
  referred_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  accepted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  signature: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "referrals",
  timestamps: true
});

export default Referral;