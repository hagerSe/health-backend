// scripts/simplePostgresFix.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";

const simplePostgresFix = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to PostgreSQL");

    const email = "ager@gmail.com";
    const password = "agi123";

    // Delete existing user
    await FederalAdmin.destroy({ where: { email } });
    console.log("✅ Deleted existing user");

    // Create new hash
    const hash = await bcrypt.hash(password, 10);
    console.log("✅ New hash created");

    // Create new user
    const newUser = await FederalAdmin.create({
      email: email,
      password: hash,
      first_name: "Federal",
      middle_name: "Admin",
      last_name: "User",
      gender: "Male",
      age: 35,
      phone: "0911123456",
      role: "Federal_Admin",
      status: "active"
    });

    console.log("✅ New user created with ID:", newUser.id);

    // Verify
    const verify = await bcrypt.compare(password, newUser.password);
    console.log(`\n🔐 PASSWORD VERIFICATION: ${verify ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (verify) {
      console.log("\n✅ READY TO LOGIN!");
      console.log("=".repeat(40));
      console.log("Email:    ager@gmail.com");
      console.log("Password: agi123");
      console.log("=".repeat(40));
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

simplePostgresFix();