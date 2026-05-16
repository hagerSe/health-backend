import bcrypt from "bcryptjs";
import FederalAdmin from "./models/FederalAdmin.js";
import sequelize from "./config/database.js";

const resetFederalAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const adminData = {
      email: "ager@gmail.com",
      password: "agi123",
      first_name: "Federal",
      middle_name: "Admin",
      last_name: "User",
      gender: "Male",
      age: 35,
      phone: "0911123456",
      role: "federal",
      status: "active"
    };

    // Delete existing user
    const deleted = await FederalAdmin.destroy({
      where: { email: adminData.email }
    });
    
    if (deleted) {
      console.log(`✅ Deleted existing user: ${adminData.email}`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);
    
    console.log("Generated hash:", hashedPassword);

    // Create new user
    const newUser = await FederalAdmin.create({
      ...adminData,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log("\n✅ FEDERAL ADMIN RESET SUCCESSFULLY!");
    console.log("=".repeat(40));
    console.log("Email:    ager@gmail.com");
    console.log("Password: agi123");
    console.log("=".repeat(40));
    
    // Verify the password works
    const verifyUser = await FederalAdmin.findOne({ 
      where: { email: adminData.email } 
    });
    const verifyPassword = await bcrypt.compare("agi123", verifyUser.password);
    console.log(`\n🔐 Password verification: ${verifyPassword ? "✅ WORKING" : "❌ FAILED"}`);

    process.exit();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit();
  }
};

resetFederalAdmin();