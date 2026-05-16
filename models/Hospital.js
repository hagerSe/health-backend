// // models/Hospital.js
// import { DataTypes } from "sequelize";
// import sequelize from "../config/database.js";

// const Hospital = sequelize.define("Hospital", {
//   id: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     autoIncrement: true
//   },
//   name: {
//     type: DataTypes.STRING(200),
//     allowNull: false
//   },
//   code: {
//     type: DataTypes.STRING(50),
//     allowNull: false,
//     unique: true
//   },
//   service_type: {
//     type: DataTypes.ENUM("Private", "Public"),
//     defaultValue: "Public"
//   },
//   hospital_type: {
//     type: DataTypes.ENUM("General", "Specialized", "Primary", "Teaching", "District", "Referral"),
//     defaultValue: "General"
//   },
//   level: {
//     type: DataTypes.ENUM("Primary", "Secondary", "Tertiary"),
//     defaultValue: "Primary"
//   },
//   region: DataTypes.STRING,
//   zone: DataTypes.STRING,
//   woreda: DataTypes.STRING,
//   kebele: DataTypes.STRING,
//   address: DataTypes.TEXT,
//   phone: DataTypes.STRING,
//   email: DataTypes.STRING,
//   website: DataTypes.STRING,
//   beds_capacity: {
//     type: DataTypes.INTEGER,
//     defaultValue: 0
//   },
//   status: {
//     type: DataTypes.STRING,
//     defaultValue: "active"
//   }
// }, {
//   tableName: "hospitals",
//   timestamps: true
// });

// export default Hospital;