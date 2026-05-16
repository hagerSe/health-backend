import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const NotificationRecipient = sequelize.define("NotificationRecipient", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  notification_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "notifications",
      key: "id"
    }
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recipient_type: {
    type: DataTypes.ENUM(
      "federal", "regional", "zone", "woreda", "kebele", "hospital", "staff"
    ),
    allowNull: false
  },
  recipient_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  recipient_level: {
    type: DataTypes.ENUM(
      "federal", "regional", "zone", "woreda", "kebele", "hospital", "staff"
    ),
    allowNull: true
  },
  
  // Status
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Delivery
  delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // User actions
  dismissed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  dismissed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // For tracking
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: "notification_recipients",
  timestamps: true
});

export default NotificationRecipient;