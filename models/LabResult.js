// models/LabResult.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const LabResult = sequelize.define("LabResult", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  request_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  patient_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  test_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  doctor_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ward: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM("pending", "completed", "cancelled"),
    defaultValue: "completed"
  },
  result: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recommendations: {
    type: DataTypes.TEXT,
    allowNull: true
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
  tableName: "lab_results",
  timestamps: true
});

// ✅ ADD THE ASSOCIATE FUNCTION HERE
LabResult.associate = (models) => {
  // Lab Request association
  LabResult.belongsTo(models.LabRequest, {
    foreignKey: 'request_id',
    as: 'labRequest'
  });
  
  // Patient association
  LabResult.belongsTo(models.Patient, {
    foreignKey: 'patient_id',
    as: 'patient'
  });
  
  // Technician association
  LabResult.belongsTo(models.HospitalStaff, {
    foreignKey: 'processed_by',
    as: 'technician',
    constraints: false
  });
};

export default LabResult;