// models/ShiftSwap.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ShiftSwap = sequelize.define("ShiftSwap", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  requesting_staff_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  target_staff_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  schedule_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "schedules",
      key: "id"
    }
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM("pending", "approved", "rejected"),
    defaultValue: "pending"
  },
  resolved_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: "shift_swaps",
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Add associations
ShiftSwap.associate = (models) => {
  ShiftSwap.belongsTo(models.HospitalStaff, {
    foreignKey: 'requesting_staff_id',
    as: 'requestingStaff'
  });
  ShiftSwap.belongsTo(models.HospitalStaff, {
    foreignKey: 'target_staff_id',
    as: 'targetStaff'
  });
  ShiftSwap.belongsTo(models.Schedule, {
    foreignKey: 'schedule_id',
    as: 'schedule'
  });
};

export default ShiftSwap;