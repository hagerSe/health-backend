import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import bcrypt from "bcryptjs";

async function checkAllZoneAdmins() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Get all zone admins
    const allAdmins = await ZoneAdmin.findAll({
      attributes: ['id', 'email', 'first_name', 'last_name', 'password', 'createdAt']
    });
    
    console.log(`\n📋 Found ${allAdmins.length} zone admins:\n`);
    
    for (const admin of allAdmins) {
      console.log(`📧 Email: ${admin.email}`);
      console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Created: ${admin.createdAt}`);
      console.log(`   Password hash length: ${admin.password.length}`);
      
      // Test common passwords
      const passwordsToTest = ["Admin@123", "password123", "admin123", "123456", "404040"];
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

checkAllZoneAdmins();