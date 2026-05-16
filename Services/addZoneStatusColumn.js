import sequelize from "../config/database.js";
import { Sequelize } from "sequelize";

async function addZoneStatusColumn() {
  try {
    console.log("🔧 Checking zone_admins table for status column...");
    
    // Check if status column exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'zone_admins' AND column_name = 'status'
    `);
    
    if (results.length === 0) {
      console.log("📝 Status column not found. Adding it now...");
      
      // Add status column
      await sequelize.query(`
        ALTER TABLE zone_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      
      console.log("✅ Status column added successfully!");
      
      // Update existing records to have status='active'
      await sequelize.query(`
        UPDATE zone_admins 
        SET status = 'active' 
        WHERE status IS NULL
      `);
      
      console.log("✅ Existing records updated with status='active'");
    } else {
      console.log("✅ Status column already exists");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding status column:", error);
    process.exit(1);
  }
}

addZoneStatusColumn();