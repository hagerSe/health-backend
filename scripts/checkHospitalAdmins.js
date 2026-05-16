import sequelize from "../config/database.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import bcrypt from "bcryptjs";

async function checkHospitalAdmins() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Get all hospital admins
    const admins = await HospitalAdmin.findAll({
      attributes: ['id', 'email', 'first_name', 'last_name', 'hospital_name', 'password', 'status', 'createdAt']
    });
    
    console.log(`\n📋 Found ${admins.length} hospital admins:\n`);
    
    for (const admin of admins) {
      console.log(`📧 Email: ${admin.email}`);
      console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   Hospital: ${admin.hospital_name}`);
      console.log(`   Status: ${admin.status}`);
      console.log(`   Created: ${admin.createdAt}`);
      console.log(`   Password hash length: ${admin.password.length}`);
      
      // Test common passwords
      const passwordsToTest = ["555555", "Admin@123", "password123", "admin123"];
      let foundMatch = false;
      
      for (const testPass of passwordsToTest) {
        const isMatch = await bcrypt.compare(testPass, admin.password);
        if (isMatch) {
          console.log(`   ✅ Password matches: "${testPass}"`);
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        console.log(`   ❌ No common password matches`);
      }
      
      console.log("   " + "-".repeat(50));
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkHospitalAdmins();