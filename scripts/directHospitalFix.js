import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nhms_database',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function directHospitalFix() {
  try {
    console.log("🔧 Connecting to database...");
    await pool.connect();
    console.log("✅ Database connected");

    console.log("📝 Checking hospital_admins table...");
    
    // Check if status column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hospital_admins' AND column_name = 'status'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("📝 Status column exists, dropping it...");
      await pool.query(`
        ALTER TABLE hospital_admins 
        DROP COLUMN IF EXISTS status
      `);
    }
    
    // Add the column as VARCHAR
    console.log("📝 Adding new status column as VARCHAR...");
    await pool.query(`
      ALTER TABLE hospital_admins 
      ADD COLUMN status VARCHAR(20) DEFAULT 'active'
    `);
    
    // Update any NULL values
    console.log("📝 Updating records...");
    await pool.query(`
      UPDATE hospital_admins 
      SET status = 'active' 
      WHERE status IS NULL
    `);
    
    console.log("✅ Hospital admins table fixed successfully!");
    
    // Show the table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'hospital_admins'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Current table structure:");
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing table:", error);
    await pool.end();
    process.exit(1);
  }
}

directHospitalFix();