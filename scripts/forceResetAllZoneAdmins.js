import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";

async function forceResetAllZoneAdmins() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const newPassword = "Admin@123";
    console.log(`\n🔑 Force resetting all zone admins to password: "${newPassword}"`);

    // Hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    console.log("✅ Password hashed");

    // Direct SQL update to bypass any hooks/issues
    const [result] = await sequelize.query(
      'UPDATE zone_admins SET password = ?',
      {
        replacements: [hashedPassword],
        type: sequelize.QueryTypes.UPDATE
      }
    );

    console.log(`✅ Updated ${result.rowCount || 'all'} zone admins`);

    // Verify the updates
    const admins = await sequelize.query(
      'SELECT id, email, first_name, last_name, password FROM zone_admins',
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log("\n📋 Verification:");
    for (const admin of admins) {
      const verifyMatch = await bcrypt.compare(newPassword, admin.password);
      console.log(`   ${admin.email}: ${verifyMatch ? '✅ WORKS' : '❌ FAILS'}`);
      
      if (!verifyMatch) {
        console.log(`   ❌ Failed for ${admin.email} - hash: ${admin.password}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

forceResetAllZoneAdmins();