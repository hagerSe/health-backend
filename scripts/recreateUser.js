// scripts/recreateUser.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";

const recreateUser = async () => {
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

    // Test the password
    const testPassword = await bcrypt.compare(password, newUser.password);
    console.log(`\n🔐 PASSWORD TEST: ${testPassword ? '✅ WORKS!' : '❌ FAILED!'}`);

    if (testPassword) {
      console.log("\n✅ SUCCESS! Login credentials:");
      console.log("=".repeat(40));
      console.log("Email:    ager@gmail.com");
      console.log("Password: agi123");
      console.log("=".repeat(40));
      
      // Show the user data
      console.log("\n📊 User data in database:");
      console.log("ID:", newUser.id);
      console.log("Email:", newUser.email);
      console.log("Name:", newUser.first_name, newUser.last_name);
      console.log("Role:", newUser.role);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

recreateUser();