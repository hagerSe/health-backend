// seeders/federalAdminSeeder2.js
import bcrypt from "bcryptjs";
import FederalAdmin from "../models/FederalAdmin.js";
import sequelize from "../config/database.js";

const seedFederalAdmin2 = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log("✅ Database connected successfully");

    // Federal admin data - different credentials
    const adminData = {
      email: "federal.admin@example.com",
      password: "federal123",
      first_name: "Super",
      middle_name: "Federal",
      last_name: "Admin",
      gender: "Male",
      age: 40,
      phone: "0988888888",
      role: "federal",
      status: "active"
    };

    // Check if admin already exists
    const existingAdmin = await FederalAdmin.findOne({
      where: { email: adminData.email }
    });

    if (existingAdmin) {
      console.log("\n⚠️ Federal admin already exists!");
      console.log("Email:", adminData.email);
      console.log("Password:", adminData.password);
      console.log("\nUse these credentials to login");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Create new federal admin
    await FederalAdmin.create({
      ...adminData,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Success message
    console.log("\n✅ FEDERAL ADMIN CREATED SUCCESSFULLY!");
    console.log("=".repeat(40));
    console.log("Email:    federal.admin@example.com");
    console.log("Password: federal123");
    console.log("=".repeat(40));
    console.log("\nYou can now login with these credentials");

  } catch (error) {
    console.error("❌ Error creating federal admin:", error.message);
  } finally {
    // Close database connection
    await sequelize.close();
    process.exit();
  }
};

// Run the seeder
seedFederalAdmin2();