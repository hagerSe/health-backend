// models/RadiologyReport.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const RadiologyReport = sequelize.define("RadiologyReport", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "radiology_requests",
      key: "id"
    }
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  patient_name: {
    type: DataTypes.STRING,
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
  hospital_id: {
    type: DataTypes.INTEGER,
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
  // ✅ CHANGE THIS FROM JSON TO TEXT
  report: {
    type: DataTypes.TEXT,  // Changed from JSON to TEXT
    allowNull: true
  },
  findings: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  impression: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  images: {
    type: DataTypes.JSONB,  // Keep this as JSON for image URLs
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM("pending", "completed", "cancelled"),
    defaultValue: "pending"
  },
  critical: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reported_by: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reported_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  processed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "radiology_reports",
  timestamps: true
});

RadiologyReport.associate = (models) => {
  RadiologyReport.belongsTo(models.RadiologyRequest, {
    foreignKey: 'request_id',
    as: 'request'
  });
};

export default RadiologyReport;