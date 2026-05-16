// models/DeliveryRecord.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const DeliveryRecord = sequelize.define("DeliveryRecord", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  patient_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  delivery_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  delivery_type: {
    type: DataTypes.ENUM("vaginal", "c-section", "assisted"),
    defaultValue: "vaginal"
  },
  complications: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  baby_weight: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: "Weight in grams"
  },
  baby_sex: {
    type: DataTypes.ENUM("male", "female", "unknown"),
    allowNull: true
  },
  apgar_score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Apgar score at 1 and 5 minutes"
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  delivered_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  delivered_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "delivery_records",
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associate method - only define ONCE
DeliveryRecord.associate = (models) => {
  // Patient association
  DeliveryRecord.belongsTo(models.Patient, {
    foreignKey: 'patient_id',
    as: 'patient',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });
  
  // HospitalStaff (Midwife) association - use unique alias
  DeliveryRecord.belongsTo(models.HospitalStaff, {
    foreignKey: 'delivered_by_id',
    as: 'delivered_by_midwife',
    constraints: false
  });
};

export default DeliveryRecord;