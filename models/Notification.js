// models/Notification.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Notification = sequelize.define("Notification", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recipient_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  recipient_ward: {
    type: DataTypes.STRING,
    allowNull: true
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // ✅ FIXED: Add 'routine' to ENUM values
  priority: {
    type: DataTypes.ENUM("low", "medium", "high", "urgent", "routine", "critical"),
    defaultValue: "medium"
  },
  reference_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sender_type: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: "notifications",
  timestamps: true,
  underscored: true
});

export default Notification;