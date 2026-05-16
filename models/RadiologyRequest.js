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
  doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  doctor_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ward: {
    type: DataTypes.ENUM("OPD", "EME", "ANC", "IPD"),
     allowNull: true,  // ✅ CHANGE TO TRUE FIRST
    defaultValue: "OPD" 
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_admins",
      key: "id"
    }
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
    type: DataTypes.ENUM("routine", "urgent", "stat"),
    defaultValue: "routine"
  },
  status: {
    type: DataTypes.ENUM("pending", "in_progress", "completed", "cancelled"),
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
    type: DataTypes.STRING,
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
RadiologyRequest.associate = (models) => {
  RadiologyRequest.hasOne(models.RadiologyReport, {
    foreignKey: 'request_id',
    as: 'report'
  });
};
export default RadiologyRequest;