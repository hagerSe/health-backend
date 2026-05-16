import sequelize from "../config/database.js";

async function fixHospitalStatusColumn() {
  try {
    console.log("🔧 Fixing status column in hospital_admins table...");
    
    // Step 1: Drop the default constraint first
    console.log("📝 Dropping default constraint...");
    await sequelize.query(`
      ALTER TABLE hospital_admins 
      ALTER COLUMN status DROP DEFAULT
    `);
    
    // Step 2: Change the column type to VARCHAR temporarily
    console.log("📝 Converting to VARCHAR temporarily...");
    await sequelize.query(`
      ALTER TABLE hospital_admins 
      ALTER COLUMN status TYPE VARCHAR(20) 
      USING status::VARCHAR
    `);
    
    // Step 3: Update any NULL values to 'active'
    console.log("📝 Updating NULL values to 'active'...");
    await sequelize.query(`
      UPDATE hospital_admins 
      SET status = 'active' 
      WHERE status IS NULL
    `);
    
    // Step 4: Create the ENUM type if it doesn't exist
    console.log("📝 Creating ENUM type...");
    await sequelize.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."enum_hospital_admins_status" AS ENUM('active', 'inactive');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Step 5: Convert to ENUM type
    console.log("📝 Converting to ENUM type...");
    await sequelize.query(`
      ALTER TABLE hospital_admins 
      ALTER COLUMN status TYPE "public"."enum_hospital_admins_status" 
      USING status::"public"."enum_hospital_admins_status"
    `);
    
    // Step 6: Set the default value back
    console.log("📝 Setting default value...");
    await sequelize.query(`
      ALTER TABLE hospital_admins 
      ALTER COLUMN status SET DEFAULT 'active'
    `);
    
    console.log("✅ Status column fixed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing status column:", error);
    process.exit(1);
  }
}

fixHospitalStatusColumn();
