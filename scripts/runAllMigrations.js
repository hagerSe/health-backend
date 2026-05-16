import sequelize from "../config/database.js";

async function runAllMigrations() {
  try {
    console.log("🚀 Starting all migrations...");
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // 1. Add status to zone_admins
    console.log("\n1️⃣ Adding status to zone_admins...");
    const [zoneColumn] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'zone_admins' AND column_name = 'status'
    `);
    
    if (zoneColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE zone_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("   ✅ Added status to zone_admins");
    } else {
      console.log("   ℹ️ status already exists in zone_admins");
    }

    // 2. Add status to woreda_admins
    console.log("\n2️⃣ Adding status to woreda_admins...");
    const [woredaColumn] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'woreda_admins' AND column_name = 'status'
    `);
    
    if (woredaColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE woreda_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("   ✅ Added status to woreda_admins");
    } else {
      console.log("   ℹ️ status already exists in woreda_admins");
    }

    // 3. Add status to kebele_admins
    console.log("\n3️⃣ Adding status to kebele_admins...");
    const [kebeleColumn] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'kebele_admins' AND column_name = 'status'
    `);
    
    if (kebeleColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE kebele_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("   ✅ Added status to kebele_admins");
    } else {
      console.log("   ℹ️ status already exists in kebele_admins");
    }

    // 4. Add status to hospital_admins
    console.log("\n4️⃣ Adding status to hospital_admins...");
    const [hospitalColumn] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hospital_admins' AND column_name = 'status'
    `);
    
    if (hospitalColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE hospital_admins 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("   ✅ Added status to hospital_admins");
    } else {
      console.log("   ℹ️ status already exists in hospital_admins");
    }

    // 5. Add status to hospital_staff
    console.log("\n5️⃣ Adding status to hospital_staff...");
    const [staffColumn] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hospital_staff' AND column_name = 'status'
    `);
    
    if (staffColumn.length === 0) {
      await sequelize.query(`
        ALTER TABLE hospital_staff 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log("   ✅ Added status to hospital_staff");
    } else {
      console.log("   ℹ️ status already exists in hospital_staff");
    }

    // Update all existing records to have status='active'
    console.log("\n📝 Updating existing records...");
    
    await sequelize.query(`
      UPDATE zone_admins SET status = 'active' WHERE status IS NULL
    `);
    console.log("   ✅ Updated zone_admins");
    
    await sequelize.query(`
      UPDATE woreda_admins SET status = 'active' WHERE status IS NULL
    `);
    console.log("   ✅ Updated woreda_admins");
    
    await sequelize.query(`
      UPDATE kebele_admins SET status = 'active' WHERE status IS NULL
    `);
    console.log("   ✅ Updated kebele_admins");
    
    await sequelize.query(`
      UPDATE hospital_admins SET status = 'active' WHERE status IS NULL
    `);
    console.log("   ✅ Updated hospital_admins");
    
    await sequelize.query(`
      UPDATE hospital_staff SET status = 'active' WHERE status IS NULL
    `);
    console.log("   ✅ Updated hospital_staff");

    console.log("\n🎉 All migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runAllMigrations();