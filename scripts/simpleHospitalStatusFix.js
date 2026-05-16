import sequelize from "../config/database.js";

async function simpleHospitalStatusFix() {
  try {
    console.log("🔧 Applying simple fix to hospital_admins table...");
    
    // First, check if the column exists
    const [columnCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hospital_admins' AND column_name = 'status'
    `);
    
    if (columnCheck.length > 0) {
      console.log("📝 Status column exists, dropping it...");
      await sequelize.query(`
        ALTER TABLE hospital_admins 
        DROP COLUMN IF EXISTS status
      `);
    }
    
    // Add the column as VARCHAR
    console.log("📝 Adding new status column as VARCHAR...");
    await sequelize.query(`
      ALTER TABLE hospital_admins 
      ADD COLUMN status VARCHAR(20) DEFAULT 'active'
    `);
    
    // Update any NULL values
    console.log("📝 Updating records...");
    await sequelize.query(`
      UPDATE hospital_admins 
      SET status = 'active' 
      WHERE status IS NULL
    `);
    
    console.log("✅ Hospital admins table fixed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing table:", error);
    process.exit(1);
  }
}

simpleHospitalStatusFix();