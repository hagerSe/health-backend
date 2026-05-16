// models/Patient.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Patient = sequelize.define("Patient", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  card_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  middle_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  gender: {
    type: DataTypes.ENUM("Male", "Female", "Other"),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(
      "registered", "in_triage", "triaged", 
      "in_opd", "in_emergency", "in_anc",
      "with_doctor", "admitted", "discharged", 
      "referred", "cancelled", "postnatal", "delivered"
    ),
    defaultValue: "registered",
    allowNull: false
  },
  ward: {
    type: DataTypes.ENUM("OPD", "EME", "ANC", "IPD", "ICU"),
    allowNull: true
  },
  vitals: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: false
  },
  triage_info: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: false
  },
  // ==================== DIAGNOSIS - NEVER NULL ====================
  diagnosis: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: false
  },
  // ==================== PRESCRIPTIONS HISTORY - NEVER NULL (FIXED) ====================
  prescriptions_history: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
    field: 'prescriptions',
    validate: {
      notNull: { msg: "Prescriptions history cannot be null" },
      isValidJSON(value) {
        if (value === null) {
          throw new Error("Prescriptions history cannot be null");
        }
      }
    },
    get() {
      const rawValue = this.getDataValue('prescriptions_history');
      if (rawValue === null || rawValue === undefined) {
        return [];
      }
      return rawValue;
    },
    set(value) {
      if (value === null || value === undefined) {
        this.setDataValue('prescriptions_history', []);
      } else {
        this.setDataValue('prescriptions_history', value);
      }
    }
  },
  // ==================== DOCTOR FIELDS ====================
  doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  doctor_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // ==================== REGISTRATION FIELDS ====================
  registered_by: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'System'
  },
  registered_by_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  registered_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  // ==================== CONSULTATION TIMES ====================
  consultation_started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  consultation_ended_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // ==================== MIDWIFE FIELDS - ONLY FOR ANC ====================
  midwife_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  midwife_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // ==================== ANTENATAL DATA - ONLY FOR ANC ====================
  antenatal_data: {
    type: DataTypes.JSONB,
    defaultValue: {
      gestational_weeks: null,
      edd: null,
      lmp: null,
      gravida: null,
      para: null,
      high_risk: false,
      risk_factors: []
    },
    allowNull: true
  },
  delivery_record_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // ==================== RETURN FIELDS ====================
  return_reason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_return: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  // ==================== ADMISSION & REFERRAL ====================
  admission_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  referral_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // ==================== DISCHARGE SUMMARY ====================
  discharge_summary: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: false
  },
  triaged_at: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // ==================== NEW DISCHARGE COLUMNS ====================
  discharge_location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  discharged_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  discharged_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  discharged_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  discharge_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  discharge_diagnosis: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  discharge_prescriptions: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  discharge_lab_results: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  discharge_signature: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // ==================== ADMISSION COLUMNS ====================
  bed_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  admitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  admitted_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  admitted_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  admission_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  admission_diagnosis: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  admission_prescriptions: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  admission_lab_results: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  admission_signature: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // ==================== REFERRAL COLUMNS ====================
  referral_data: {
    type: DataTypes.JSONB,
    allowNull: true
  },

  // ==================== CURRENT PRESCRIPTIONS ====================
  prescriptions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false
  }
}, {
  tableName: "patients",
  timestamps: true,
  hooks: {
    beforeCreate: async (patient) => {
      console.log('🔄 Running beforeCreate hook for patient');
      
      try {
        const year = new Date().getFullYear();
        const lastPatient = await Patient.findOne({
          order: [['createdAt', 'DESC']],
          attributes: ['card_number']
        });
        
        let sequence = 1;
        if (lastPatient && lastPatient.card_number) {
          const parts = lastPatient.card_number.split('/');
          if (parts.length === 2) {
            const lastNumber = parseInt(parts[1]);
            if (!isNaN(lastNumber)) {
              sequence = lastNumber + 1;
            }
          }
        }
        
        const newCardNumber = `${year}/${String(sequence).padStart(4, '0')}`;
        patient.card_number = newCardNumber;
        patient.registered_at = new Date();
        
        if (patient.prescriptions_history === null || patient.prescriptions_history === undefined) {
          patient.prescriptions_history = [];
        }
        
        if (patient.prescriptions === null || patient.prescriptions === undefined) {
          patient.prescriptions = [];
        }
        
        if (!patient.diagnosis) patient.diagnosis = {};
        if (!patient.discharge_summary) patient.discharge_summary = {};
        if (!patient.vitals) patient.vitals = {};
        if (!patient.triage_info) patient.triage_info = {};
        
      } catch (error) {
        console.error('Error in beforeCreate hook:', error);
        patient.card_number = `${new Date().getFullYear()}/0001`;
        if (patient.prescriptions_history === null || patient.prescriptions_history === undefined) {
          patient.prescriptions_history = [];
        }
        if (patient.prescriptions === null || patient.prescriptions === undefined) {
          patient.prescriptions = [];
        }
      }
    },
    beforeUpdate: async (patient) => {
      if (patient.prescriptions_history === null) {
        patient.prescriptions_history = [];
      }
      if (patient.prescriptions === null) {
        patient.prescriptions = [];
      }
    },
    afterFind: (instances) => {
      if (instances) {
        const processInstance = (instance) => {
          if (instance && (instance.prescriptions_history === null || instance.prescriptions_history === undefined)) {
            instance.prescriptions_history = [];
          }
          if (instance && (instance.prescriptions === null || instance.prescriptions === undefined)) {
            instance.prescriptions = [];
          }
        };
        
        if (Array.isArray(instances)) {
          instances.forEach(processInstance);
        } else {
          processInstance(instances);
        }
      }
    }
  }
});

// ASSOCIATE FUNCTION
Patient.associate = (models) => {
  Patient.hasMany(models.LabRequest, {
    foreignKey: 'patient_id',
    as: 'lab_requests'
  });
  
  Patient.hasMany(models.RadiologyRequest, {
    foreignKey: 'patient_id',
    as: 'radiology_requests'
  });
  
  Patient.hasMany(models.Prescription, {
    foreignKey: 'patient_id',
    as: 'prescription_records'
  });
  
  Patient.belongsTo(models.HospitalStaff, {
    foreignKey: 'midwife_id',
    as: 'assigned_midwife',
    constraints: false
  });
  
  Patient.belongsTo(models.HospitalStaff, {
    foreignKey: 'doctor_id',
    as: 'assigned_doctor',
    constraints: false
  });
  
  Patient.hasMany(models.AntenatalVisit, {
    foreignKey: 'patient_id',
    as: 'antenatal_visits',
    onDelete: 'CASCADE'
  });
  
  Patient.hasOne(models.DeliveryRecord, {
    foreignKey: 'patient_id',
    as: 'delivery_record',
    onDelete: 'CASCADE'
  });
};

// ==================== INSTANCE METHODS ====================

Patient.prototype.getPrescriptionRecords = async function() {
  if (!this.prescription_records) {
    return [];
  }
  return this.prescription_records;
};

Patient.prototype.addToPrescriptionHistory = function(prescriptionData) {
  let currentHistory = this.prescriptions_history;
  if (!currentHistory || !Array.isArray(currentHistory)) {
    currentHistory = [];
  }
  currentHistory.push({
    ...prescriptionData,
    added_at: new Date().toISOString()
  });
  this.prescriptions_history = currentHistory;
  return this.save();
};

Patient.prototype.getPrescriptionHistory = function() {
  const history = this.prescriptions_history;
  return Array.isArray(history) ? history : [];
};

Patient.prototype.isANC = function() {
  return this.ward === 'ANC';
};

Patient.prototype.isOPD = function() {
  return this.ward === 'OPD';
};

Patient.prototype.isEME = function() {
  return this.ward === 'EME';
};

Patient.prototype.getFullName = function() {
  return `${this.first_name} ${this.last_name}`.trim();
};

export default Patient;