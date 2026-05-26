import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Schedule = sequelize.define("Schedule", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  staff_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_staff",
      key: "id"
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  shift_type: {
    type: DataTypes.ENUM("morning", "afternoon", "night"),
    allowNull: false
  },
  ward: {
    type: DataTypes.ENUM("OPD", "EME", "ANC"),
    allowNull: false
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM("scheduled", "completed", "cancelled"),
    defaultValue: "scheduled"
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "schedules",
  timestamps: true
});

export default Schedule;