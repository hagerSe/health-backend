import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import bcrypt from "bcryptjs";

async function resetZonePassword() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Get email from command line or use default
    const email = process.argv[2] || "agerneshdereje40@gmail.com";
    const newPassword = process.argv[3] || "Admin@123";

    console.log(`\n🔄 Resetting password for: ${email}`);
    console.log(`   New password: ${newPassword}`);

    const zoneAdmin = await ZoneAdmin.findOne({
      where: { email }
    });

    if (!zoneAdmin) {
      console.log("❌ Zone admin not found with email:", email);
      
      // List all zone admins
      const allAdmins = await ZoneAdmin.findAll({
        attributes: ['id', 'email', 'first_name', 'last_name']
      });
      
      console.log("\n📋 Available zone admins:");
      allAdmins.forEach(admin => {
        console.log(`   - ${admin.email} (${admin.first_name} ${admin.last_name})`);
      });
      
      process.exit(1);
    }

    console.log(`\n👤 Found zone admin: ${zoneAdmin.first_name} ${zoneAdmin.last_name}`);
    console.log(`   Current password hash length: ${zoneAdmin.password.length}`);

    // Hash the new password
    console.log("\n🔐 Hashing new password...");
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    console.log(`   New hash length: ${hashedPassword.length}`);

    // Update the password
    await zoneAdmin.update({ password: hashedPassword });
    console.log("✅ Password updated in database");

    // Verify the new password works
    console.log("\n🔑 Verifying new password...");
    const verifyMatch = await bcrypt.compare(newPassword, zoneAdmin.password);
    console.log(`   Verification: ${verifyMatch ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (verifyMatch) {
      console.log(`\n✅ Password reset successful!`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log(`\n❌ Password verification failed after update!`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

resetZonePassword();