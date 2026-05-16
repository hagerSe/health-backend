import bcrypt from "bcryptjs";
import FederalAdmin from "./models/FederalAdmin.js";
import sequelize from "./config/database.js";

const debugPassword = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected\n");

    const email = "ager@gmail.com";
    const user = await FederalAdmin.findOne({ where: { email } });

    if (!user) {
      console.log("❌ User not found!");
      process.exit();
    }

    console.log("=".repeat(50));
    console.log("📋 USER DETAILS:");
    console.log("=".repeat(50));
    console.log("Email:", user.email);
    console.log("Stored password hash:", user.password);
    console.log("First name:", user.first_name);
    console.log("Role:", user.role);
    console.log("Status:", user.status);
    console.log("");

    // Test different password combinations
    const passwordsToTest = [
      "agi123",
      "federal123",
      "password123",
      "admin123",
      "123456"
    ];

    console.log("🔐 TESTING PASSWORDS:");
    console.log("=".repeat(50));

    for (const testPassword of passwordsToTest) {
      const isValid = await bcrypt.compare(testPassword, user.password);
      if (isValid) {
        console.log(`✅ CORRECT PASSWORD: "${testPassword}"`);
        break;
      } else {
        console.log(`❌ Wrong: "${testPassword}"`);
      }
    }

    console.log("\n💡 TIP: Run the seeder again to reset password:");
    console.log("   node seeders/federalAdminSeeder.js");

    process.exit();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit();
  }
};

debugPassword();