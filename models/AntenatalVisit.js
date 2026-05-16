// models/AntenatalVisit.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const AntenatalVisit = sequelize.define("AntenatalVisit", {
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
  midwife_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  midwife_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  visit_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  gestational_weeks: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  complaints: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  examination: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  advice: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  next_appointment: {
    type: DataTypes.DATE,
    allowNull: true
  },
  vitals: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "antenatal_visits",
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associate method - only define ONCE
AntenatalVisit.associate = (models) => {
  // Patient association
  AntenatalVisit.belongsTo(models.Patient, {
    foreignKey: 'patient_id',
    as: 'patient',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });
  
  // HospitalStaff (Midwife) association - use unique alias
  AntenatalVisit.belongsTo(models.HospitalStaff, {
    foreignKey: 'midwife_id',
    as: 'midwife',
    constraints: false
  });
};

export default AntenatalVisit;