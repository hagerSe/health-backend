// seeders/federalAdminSeeder.js
import bcrypt from "bcryptjs";
import FederalAdmin from "../models/FederalAdmin.js";
import sequelize from "../config/database.js";

const seedFederalAdmin = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log("✅ Database connected successfully");

    // Federal admin data - simple and clean
    const adminData = {
      email: "ager@gmail.com",  // Simple Gmail address
      password: "agi123",         // Simple password
      first_name: "Federal",
      middle_name: "Admin",
      last_name: "User",
      gender: "Male",
      age: 35,
      phone: "0911123456",
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
    console.log("Email:    ager@gmail.com");
    console.log("Password: agi123");
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
seedFederalAdmin();