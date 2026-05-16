import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";

async function checkHospitalNow() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected\n");

    // Get all hospital admins
    const [admins] = await sequelize.query(`
      SELECT 
        ha.id, 
        ha.email, 
        ha.first_name, 
        ha.last_name, 
        ha.hospital_name,
        ha.status,
        ha.password,
        ha."createdAt",
        ka.kebele_name,
        ka.email as kebele_email
      FROM hospital_admins ha
      LEFT JOIN kebele_admins ka ON ha.kebele_id = ka.id
      ORDER BY ha.id
    `);

    console.log(`📋 Found ${admins.length} hospital admins:\n`);
    
    for (const admin of admins) {
      console.log(`📧 Email: ${admin.email}`);
      console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   Hospital: ${admin.hospital_name}`);
      console.log(`   Kebele: ${admin.kebele_name || 'N/A'}`);
      console.log(`   Kebele Admin: ${admin.kebele_email || 'N/A'}`);
      console.log(`   Status: ${admin.status}`);
      console.log(`   Created: ${admin.createdAt}`);
      console.log(`   Password hash length: ${admin.password.length}`);
      
      // Test common passwords
      const passwordsToTest = ["555555"];
      for (const testPass of passwordsToTest) {
        const isMatch = await bcrypt.compare(testPass, admin.password);
        if (isMatch) {
          console.log(`   ✅ Password matches: "${testPass}"`);
          break;
        }
      }
      
      console.log("   " + "-".repeat(50));
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkHospitalNow();