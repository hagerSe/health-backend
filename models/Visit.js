// models/Visit.js
import { DataTypes, Op } from "sequelize";  // ✅ IMPORT Op
import sequelize from "../config/database.js";

const Visit = sequelize.define("Visit", {
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
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_admins",
      key: "id"
    }
  },
  visit_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  visit_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  visit_type: {
    type: DataTypes.ENUM('OPD', 'EME', 'ANC', 'Follow-up', 'Emergency'),
    allowNull: false,
    defaultValue: 'OPD'
  },
  status: {
    type: DataTypes.ENUM(
      "active", 
      "waiting_triage",
      "in_triage",
      "completed", 
      "admitted", 
      "referred",
      "cancelled",
      "in_progress"
    ),
    defaultValue: "active"
  },
  department: {
    type: DataTypes.ENUM("OPD", "EME", "ANC"),
    allowNull: true
  },
  assigned_doctor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  assigned_doctor_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  assigned_nurse_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  assigned_nurse_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  triage_data: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  chief_complaint: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  diagnosis: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  vitals: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  lab_requests: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  radiology_requests: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  prescriptions: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  outcome: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['discharged', 'admitted', 'referred', 'deceased', 'ama', 'transferred']]
    }
  },
  discharge_summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  discharged_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  follow_up_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  referred_to: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referred_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referral_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_return_visit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: "visits",
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['visit_number']
    },
    {
      fields: ['patient_id']
    },
    {
      fields: ['hospital_id']
    },
    {
      fields: ['assigned_doctor_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['visit_date']
    }
  ],
  hooks: {
    beforeCreate: async (visit) => {
      console.log('🔄 Running beforeCreate hook for visit');
      
      try {
        // Generate visit number: VIS-YYYYMMDD-XXXX
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        
        // Count visits today - ✅ Op is now imported
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const todayCount = await Visit.count({
          where: {
            visit_date: {
              [Op.between]: [startOfDay, endOfDay]  // ✅ Op.between works now
            }
          }
        });
        
        const sequence = String(todayCount + 1).padStart(4, '0');
        visit.visit_number = `VIS-${dateStr}-${sequence}`;
        
        console.log('✅ Generated visit number:', visit.visit_number);
        
      } catch (error) {
        console.error('❌ Error in beforeCreate hook:', error);
        // Fallback
        visit.visit_number = `VIS-${Date.now()}`;
      }
    },
    beforeUpdate: async (visit) => {
      if (visit.changed('outcome') && visit.outcome && !visit.discharged_at) {
        visit.discharged_at = new Date();
      }
    }
  }
});

export default Visit;