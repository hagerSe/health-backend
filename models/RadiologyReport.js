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
  radiologist_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  radiologist_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  clinical_history: {
    type: DataTypes.TEXT,
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
  recommendations: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // ❌ REMOVE images field completely
  status: {
    type: DataTypes.ENUM("pending", "submitted", "completed"),
    defaultValue: "submitted"
  },
  critical: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reported_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reported_at: {
    type: DataTypes.DATE,
    allowNull: true
  },

  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // models/RadiologyReport.js - ADD THIS FIELD
images: {
  type: DataTypes.JSONB,
  allowNull: true,
  defaultValue: [],
  comment: "Store array of image objects with URLs, keys, metadata"
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