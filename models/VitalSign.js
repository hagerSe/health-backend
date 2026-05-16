// models/VitalSign.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const VitalSign = sequelize.define("VitalSign", {
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
  
  // Recorded by - make these optional with defaults
  recorded_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,  // Changed from false to true
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  recorded_by_name: {
    type: DataTypes.STRING,
    allowNull: true,  // Changed from false to true
    defaultValue: 'System'  // Add default value
  },
  recorded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  // Vital signs
  blood_pressure: {
    type: DataTypes.STRING,
    allowNull: true
  },
  temperature: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: true
  },
  heart_rate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  respiratory_rate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  oxygen_saturation: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  weight: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true
  },
  height: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true
  },
  bmi: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: true
  },
  pain_level: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 10
    }
  },
  
  consciousness: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Alert',
    validate: {
      isIn: [['Alert', 'Verbal', 'Pain', 'Unresponsive']]
    }
  },
  
  // For pregnant patients
  is_pregnant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  weeks_pregnant: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
  // Critical flag
  is_critical: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "vital_signs",
  timestamps: true,
  underscored: true
});

export default VitalSign;