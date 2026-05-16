import bcrypt from "bcryptjs";
import sequelize from "./config/database.js";
import FederalAdmin from "./models/FederalAdmin.js";

const forceCreate = async () => {
  try {
    await sequelize.sync();
    console.log("✅ Database synced\n");
    
    // Delete any existing record with this email
    const deleted = await FederalAdmin.destroy({
      where: { email: "ager@gmail.com" },
      force: true
    });
    console.log(`🗑️ Deleted ${deleted} existing records\n`);
    
    // Create new admin
    const hashedPassword = await bcrypt.hash("agi123", 10);
    
    const newAdmin = await FederalAdmin.create({
      email: "ager@gmail.com",
      password: hashedPassword,
      first_name: "Federal",
      middle_name: "Admin",
      last_name: "User",
      gender: "Male",
      age: 35,
      phone: "0911123456",
      role: "federal",
      status: "active"
    });
    
    console.log("✅ FEDERAL ADMIN CREATED!");
    console.log("=".repeat(40));
    console.log(`ID: ${newAdmin.id}`);
    console.log(`Email: ${newAdmin.email}`);
    console.log(`Name: ${newAdmin.first_name} ${newAdmin.last_name}`);
    console.log(`Password: agi123`);
    console.log("=".repeat(40));
    
    // Verify it was created
    const verify = await FederalAdmin.findOne({
      where: { email: "ager@gmail.com" }
    });
    
    if (verify) {
      console.log("\n✅ Verification: Admin exists in database!");
      const passwordMatch = await bcrypt.compare("agi123", verify.password);
      console.log(`✅ Password verification: ${passwordMatch ? "SUCCESS" : "FAILED"}`);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
};

forceCreate();