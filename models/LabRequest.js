// models/LabRequest.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const LabRequest = sequelize.define("LabRequest", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  request_number: {
    type: DataTypes.STRING,
    allowNull: false,
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
    type: DataTypes.STRING,
    allowNull: false
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  test_type: {
    type: DataTypes.ENUM('blood', 'urine', 'stool', 'other'),
    defaultValue: 'blood'
  },
  test_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('routine', 'urgent', 'stat'),
    defaultValue: 'routine'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requested_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processed_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  technician_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cancellation_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cancelled_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'lab_requests',
  timestamps: true
});

// ✅ ADD THE ASSOCIATE FUNCTION HERE
LabRequest.associate = (models) => {
  // Patient association
  LabRequest.belongsTo(models.Patient, {
    foreignKey: 'patient_id',
    as: 'patient'
  });
  
  // Lab Result association
  LabRequest.hasOne(models.LabResult, {
    foreignKey: 'request_id',
    as: 'labResult',
    onDelete: 'CASCADE'
  });
  
  // Doctor association
  LabRequest.belongsTo(models.HospitalStaff, {
    foreignKey: 'doctor_id',
    as: 'requesting_doctor',
    constraints: false
  });
};

export default LabRequest;