// models/RadiologyRequest.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const RadiologyRequest = sequelize.define("RadiologyRequest", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  request_number: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  patient_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  doctor_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ward: {
    type: DataTypes.STRING,  // Use STRING instead of ENUM
    allowNull: true,
    defaultValue: "OPD"
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  exam_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  body_part: {
    type: DataTypes.STRING,
    allowNull: false
  },
  priority: {
    type: DataTypes.STRING,  // Use STRING instead of ENUM
    defaultValue: "routine"
  },
  status: {
    type: DataTypes.STRING,  // Use STRING instead of ENUM
    defaultValue: "pending"
  },
  clinical_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  started_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  report_id: {
    type: DataTypes.STRING,  // ✅ Keep as STRING to avoid migration issues
    allowNull: true
  },
  report_submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: "radiology_requests",
  timestamps: true
});

export default RadiologyRequest;