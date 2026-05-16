
import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import bcrypt from "bcryptjs";

async function fixAllZonePasswords() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Get all zone admins
    const allAdmins = await ZoneAdmin.findAll();
    
    console.log(`\n📋 Found ${allAdmins.length} zone admins to fix:\n`);
    
    const newPassword = "Admin@123"; // Set all to this password
    console.log(`🔑 Setting all passwords to: "${newPassword}"\n`);

    for (const admin of allAdmins) {
      console.log(`📧 Fixing: ${admin.email} (${admin.first_name} ${admin.last_name})`);
      console.log(`   Old hash length: ${admin.password.length}`);
      
      // Hash the new password properly (ONCE)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update the password
      await admin.update({ password: hashedPassword });
      
      console.log(`   New hash length: ${hashedPassword.length}`);
      
      // Verify the new password works
      const verifyMatch = await bcrypt.compare(newPassword, hashedPassword);
      console.log(`   Verification: ${verifyMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log("   " + "-".repeat(50));
    }

    console.log("\n✅ All zone admin passwords have been reset to: Admin@123");
    console.log("📧 They can now login with:");
    console.log("   Email: [their email]");
    console.log("   Password: Admin@123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixAllZonePasswords();