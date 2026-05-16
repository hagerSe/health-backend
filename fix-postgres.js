import bcrypt from "bcryptjs";
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const fixPostgres = async () => {
  // Create PostgreSQL client
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'nhms_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log("🔌 Connecting to PostgreSQL...");
    await client.connect();
    console.log("✅ Connected to PostgreSQL\n");

    // Check if federal_admins table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'federal_admins'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ federal_admins table doesn't exist!");
      console.log("Please run migrations first.");
      return;
    }

    console.log("✅ federal_admins table exists\n");

    // Check for ager@gmail.com
    const result = await client.query(
      'SELECT * FROM federal_admins WHERE email = $1',
      ['ager@gmail.com']
    );

    if (result.rows.length > 0) {
      console.log("✅ Found existing federal admin:");
      console.log(`   Email: ${result.rows[0].email}`);
      console.log(`   Name: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
      console.log(`   Role: ${result.rows[0].role}`);
      
      // Update password to ensure it's correct
      const hashedPassword = await bcrypt.hash("agi123", 10);
      await client.query(
        'UPDATE federal_admins SET password = $1 WHERE email = $2',
        [hashedPassword, 'ager@gmail.com']
      );
      console.log("\n✅ Password updated!");
    } else {
      console.log("❌ No federal admin found. Creating one...\n");
      
      const hashedPassword = await bcrypt.hash("agi123", 10);
      
      await client.query(`
        INSERT INTO federal_admins 
        (email, password, first_name, middle_name, last_name, gender, age, phone, role, status, created_at, updated_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `, [
        'ager@gmail.com',
        hashedPassword,
        'Federal',
        'Admin',
        'User',
        'Male',
        35,
        '0911123456',
        'federal',
        'active'
      ]);
      
      console.log("✅ Federal admin created!");
    }

    // Verify the admin
    const verify = await client.query(
      'SELECT email, first_name, last_name FROM federal_admins WHERE email = $1',
      ['ager@gmail.com']
    );
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ VERIFICATION:");
    console.log(`   Email: ${verify.rows[0].email}`);
    console.log(`   Name: ${verify.rows[0].first_name} ${verify.rows[0].last_name}`);
    console.log("\n🔐 LOGIN CREDENTIALS:");
    console.log(`   Email: ager@gmail.com`);
    console.log(`   Password: agi123`);
    console.log("=".repeat(50));
    
    // Test the password
    const testMatch = await bcrypt.compare("agi123", verify.rows[0].password);
    console.log(`\n🔑 Password test: ${testMatch ? "✅ SUCCESS" : "❌ FAILED"}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\nMake sure your .env file has correct PostgreSQL credentials:");
    console.log("DB_HOST=localhost");
    console.log("DB_PORT=5432");
    console.log("DB_NAME=your_database_name");
    console.log("DB_USER=postgres");
    console.log("DB_PASSWORD=your_password");
  } finally {
    await client.end();
    console.log("\n✅ Database connection closed");
  }
};

fixPostgres();