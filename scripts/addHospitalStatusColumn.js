import sequelize from "../config/database.js";

async function addHospitalStatusColumn() {
  try {
    console.log("🔧 Adding status column to hospital_admins table...");
    
    // Check if column exists
    const [result] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hospital_admins' AND column_name = 'status'
    `);
    
    if (result.length === 0) {
      // Add status column
      await sequelize.query(`
        ALTER TABLE hospital_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("✅ Status column added to hospital_admins successfully!");
    } else {
      console.log("ℹ️ Status column already exists in hospital_admins");
    }
    
    // Update any existing records to have status='active'
    await sequelize.query(`
      UPDATE hospital_admins 
      SET status = 'active' 
      WHERE status IS NULL
    `);
    console.log("✅ Existing hospital_admin records updated with status='active'");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding status column:", error);
    process.exit(1);
  }
}

addHospitalStatusColumn();