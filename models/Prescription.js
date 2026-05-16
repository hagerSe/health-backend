// models/Prescription.js - Make sure associations are correct

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Prescription = sequelize.define("Prescription", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  prescription_number: {
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
    type: DataTypes.ENUM("OPD", "EME", "ANC", "IPD"),
    allowNull: false
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM("routine", "urgent", "stat"),
    defaultValue: "routine"
  },
  status: {
    type: DataTypes.ENUM("pending", "prepared", "dispensed", "cancelled"),
    defaultValue: "pending"
  },
  items: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  prepared_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  prepared_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dispensed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dispensed_by: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: "prescriptions",
  timestamps: true,
  hooks: {
    beforeCreate: async (prescription) => {
      if (!prescription.prescription_number) {
        const year = new Date().getFullYear();
        const lastPrescription = await Prescription.findOne({
          order: [['createdAt', 'DESC']],
          attributes: ['prescription_number']
        });
        
        let sequence = 1;
        if (lastPrescription && lastPrescription.prescription_number) {
          const parts = lastPrescription.prescription_number.split('-');
          if (parts.length === 2) {
            const lastNumber = parseInt(parts[1]);
            if (!isNaN(lastNumber)) {
              sequence = lastNumber + 1;
            }
          }
        }
        prescription.prescription_number = `RX-${year}-${String(sequence).padStart(5, '0')}`;
      }
    }
  }
});

// Add associations
Prescription.associate = (models) => {
  Prescription.belongsTo(models.Patient, {
    foreignKey: 'patient_id',
    as: 'patient'
  });
  
  Prescription.belongsTo(models.HospitalStaff, {
    foreignKey: 'doctor_id',
    as: 'doctor'
  });
};

export default Prescription;