import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import bcrypt from "bcryptjs";

async function debugLogin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const testEmail = "agerneshdereje47@gmail.com";
    const testPassword = "Admin@123";

    // 1. Find the user
    const zoneAdmin = await ZoneAdmin.findOne({
      where: { email: testEmail }
    });

    if (!zoneAdmin) {
      console.log("❌ User not found with email:", testEmail);
      process.exit(1);
    }

    console.log("\n🔍 User found:");
    console.log("   Email:", zoneAdmin.email);
    console.log("   Name:", zoneAdmin.first_name, zoneAdmin.last_name);
    console.log("   Stored password hash:", zoneAdmin.password);
    console.log("   Hash length:", zoneAdmin.password.length);

    // 2. Test password comparison directly
    console.log("\n🔑 Testing password comparison...");
    const isMatch = await bcrypt.compare(testPassword, zoneAdmin.password);
    console.log(`   Password "${testPassword}": ${isMatch ? '✅ MATCHES' : '❌ DOES NOT MATCH'}`);

    // 3. If it doesn't match, let's reset it again
    if (!isMatch) {
      console.log("\n🔄 Password doesn't match. Resetting now...");
      
      // Hash the password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      
      // Update directly with SQL to bypass hooks
      await sequelize.query(
        'UPDATE zone_admins SET password = ? WHERE email = ?',
        {
          replacements: [hashedPassword, testEmail],
          type: sequelize.QueryTypes.UPDATE
        }
      );
      
      console.log("✅ Password reset via direct SQL");
      
      // Verify the new password
      const updatedAdmin = await ZoneAdmin.findOne({
        where: { email: testEmail }
      });
      
      const verifyMatch = await bcrypt.compare(testPassword, updatedAdmin.password);
      console.log(`   Verification after reset: ${verifyMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    // 4. Test all zone admins
    console.log("\n📋 Checking all zone admins:");
    const allAdmins = await ZoneAdmin.findAll();
    
    for (const admin of allAdmins) {
      const match = await bcrypt.compare(testPassword, admin.password);
      console.log(`   ${admin.email}: ${match ? '✅ WORKS' : '❌ FAILS'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

debugLogin();