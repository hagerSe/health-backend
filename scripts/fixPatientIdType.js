// scripts/fixPatientIdType.js
import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";

const fixPatientIdType = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to PostgreSQL");

    // Check current column type
    const columnInfo = await sequelize.query(
      `SELECT data_type 
       FROM information_schema.columns 
       WHERE table_name = 'patients' 
       AND column_name = 'id'`,
      { type: QueryTypes.SELECT }
    );
    
    console.log("Current id column type:", columnInfo[0]?.data_type);

    if (columnInfo[0]?.data_type === 'integer') {
      console.log("\n🔄 Changing id column from INTEGER to BIGINT...");
      
      // Alter the column type
      await sequelize.query(
        `ALTER TABLE patients ALTER COLUMN id TYPE BIGINT`,
        { type: QueryTypes.RAW }
      );
      
      console.log("✅ Column type changed to BIGINT");
      
      // Also update foreign key columns in other tables
      const tables = ['queues', 'appointments', 'medical_records'];
      
      for (const table of tables) {
        try {
          await sequelize.query(
            `ALTER TABLE ${table} ALTER COLUMN patient_id TYPE BIGINT`,
            { type: QueryTypes.RAW }
          );
          console.log(`✅ Updated ${table}.patient_id to BIGINT`);
        } catch (err) {
          console.log(`⚠️ Could not update ${table}:`, err.message);
        }
      }
      
      console.log("\n✅ FIX COMPLETE! Patient ID column now supports large numbers.");
    } else {
      console.log("✅ Column type is already BIGINT or suitable for large numbers");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

fixPatientIdType();