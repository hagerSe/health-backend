import sequelize from "../config/database.js";

async function addAllStatusColumns() {
  try {
    console.log("🚀 Starting migration to add status columns to ALL tables...");
    await sequelize.authenticate();
    console.log("✅ Database connected\n");

    const tables = [
      { name: "federal_admins", display: "Federal Admins" },
      { name: "regional_admins", display: "Regional Admins" },
      { name: "zone_admins", display: "Zone Admins" },
      { name: "woreda_admins", display: "Woreda Admins" },
      { name: "kebele_admins", display: "Kebele Admins" },
      { name: "hospital_admins", display: "Hospital Admins" },
      { name: "hospital_staff", display: "Hospital Staff" }
    ];

    for (const table of tables) {
      console.log(`\n📋 Checking ${table.display} (${table.name})...`);
      
      // Check if column exists
      const [result] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${table.name}' AND column_name = 'status'
      `);
      
      if (result.length === 0) {
        console.log(`   ➕ Adding status column to ${table.name}...`);
        
        // First try with VARCHAR
        try {
          await sequelize.query(`
            ALTER TABLE ${table.name} 
            ADD COLUMN status VARCHAR(20) DEFAULT 'active'
          `);
          console.log(`   ✅ Status column added to ${table.name} as VARCHAR`);
        } catch (err) {
          console.log(`   ⚠️ VARCHAR failed, trying with TEXT...`);
          await sequelize.query(`
            ALTER TABLE ${table.name} 
            ADD COLUMN status TEXT DEFAULT 'active'
          `);
          console.log(`   ✅ Status column added to ${table.name} as TEXT`);
        }
      } else {
        console.log(`   ℹ️ Status column already exists in ${table.name}`);
      }
      
      // Update existing records
      await sequelize.query(`
        UPDATE ${table.name} 
        SET status = 'active' 
        WHERE status IS NULL OR status = ''
      `);
      console.log(`   ✅ Existing records in ${table.name} updated`);
    }

    console.log("\n🎉 All migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addAllStatusColumns();