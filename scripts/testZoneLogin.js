import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import bcrypt from "bcryptjs";

async function testZoneLogin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Find a zone admin (replace with the email you created)
    const testEmail = "agerneshdereje40@gmail.com"; // Change this to your test email
    
    const zoneAdmin = await ZoneAdmin.findOne({
      where: { email: testEmail }
    });

    if (!zoneAdmin) {
      console.log("❌ Zone admin not found with email:", testEmail);
      
      // List all zone admins
      const allAdmins = await ZoneAdmin.findAll({
        attributes: ['id', 'email', 'first_name', 'last_name', 'password']
      });
      
      console.log("\n📋 Available zone admins:");
      for (const admin of allAdmins) {
        console.log(`   - ${admin.email} (${admin.first_name} ${admin.last_name})`);
        
        // Test if "Admin@123" works
        const testPass = "404040";
        const isMatch = await bcrypt.compare(testPass, admin.password);
        console.log(`     Password "Admin@123": ${isMatch ? '✅ WORKS' : '❌ FAILS'}`);
      }
      
      process.exit(1);
    }

    console.log("\n🔍 Testing login for:", zoneAdmin.email);
    console.log("   Name:", zoneAdmin.first_name, zoneAdmin.last_name);
    console.log("   Stored password hash length:", zoneAdmin.password.length);

    // Test common passwords
    const passwordsToTest = ["Admin@123", "password123", "admin123", "123456"];
    
    console.log("\n🔑 Testing common passwords:");
    for (const testPassword of passwordsToTest) {
      const isMatch = await bcrypt.compare(testPassword, zoneAdmin.password);
      console.log(`   Password "${testPassword}": ${isMatch ? '✅ MATCHES' : '❌ DOES NOT MATCH'}`);
      
      if (isMatch) {
        console.log(`\n✅ SUCCESS! The correct password is: ${testPassword}`);
        break;
      }
    }

    // If none match, offer to reset
    console.log("\n🔄 If none of the passwords match, you can reset the password:");
    console.log("   1. Update the password manually in the database");
    console.log("   2. Or create a new zone admin with a known password");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testZoneLogin();