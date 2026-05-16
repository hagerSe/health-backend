import sequelize from "../config/database.js";

async function addFederalStatusColumn() {
  try {
    console.log("🔧 Adding status column to federal_admins table...");
    
    // Check if column exists
    const [result] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'federal_admins' AND column_name = 'status'
    `);
    
    if (result.length === 0) {
      // Add status column
      await sequelize.query(`
        ALTER TABLE federal_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("✅ Status column added to federal_admins successfully!");
    } else {
      console.log("ℹ️ Status column already exists in federal_admins");
    }
    
    // Update any existing records to have status='active'
    await sequelize.query(`
      UPDATE federal_admins 
      SET status = 'active' 
      WHERE status IS NULL
    `);
    console.log("✅ Existing federal_admin records updated with status='active'");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding status column:", error);
    process.exit(1);
  }
}

addFederalStatusColumn();