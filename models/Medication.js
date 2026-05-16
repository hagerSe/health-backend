import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Medication = sequelize.define("Medication", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  generic_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dosage_form: {
    type: DataTypes.STRING,
    allowNull: true
  },
  strength: {
    type: DataTypes.STRING,
    allowNull: true
  },
  current_stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'tablet'
  },
  reorder_level: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  manufacturer: {
    type: DataTypes.STRING,
    allowNull: true
  },
  supplier: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  last_restocked: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_dispensed: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "medications",
  timestamps: true
});

export default Medication;