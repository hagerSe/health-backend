import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Admission = sequelize.define("Admission", {
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
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ward: {
    type: DataTypes.ENUM("OPD", "EME", "ANC", "IPD", "ICU"),
    allowNull: false
  },
  bed_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "beds",
      key: "id"
    }
  },
  bed_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  admission_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  admitted_by: {
    type: DataTypes.STRING,
    allowNull: false
  },
  admitted_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  expected_discharge_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  discharge_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  discharge_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM("active", "discharged", "transferred"),
    defaultValue: "active"
  },
  signature: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "admissions",
  timestamps: true
});

export default Admission;