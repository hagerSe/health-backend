// models/Inventory.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Inventory = sequelize.define("Inventory", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "hospital_admins",
      key: "id"
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM("medication", "supply", "equipment"),
    defaultValue: "medication"
  },
  current_stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reorder_level: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  manufacturer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  last_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "inventory",
  timestamps: true
});

export default Inventory;