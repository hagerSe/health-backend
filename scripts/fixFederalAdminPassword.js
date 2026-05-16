// scripts/fixFederalAdminPassword.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";

const fixFederalAdminPassword = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const email = "ager@gmail.com";
    const newPassword = "agi123";

    // Find the user
    const user = await FederalAdmin.findOne({ 
      where: { email } 
    });

    if (!user) {
      console.log("❌ User not found with email:", email);
      return;
    }

    console.log("✅ User found:");
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Current hash:", user.password);

    // Generate new hash
    console.log("\n🔄 Generating new password hash...");
    const newHash = await bcrypt.hash(newPassword, 10);
    console.log("New hash:", newHash);

    // Update password
    await user.update({ 
      password: newHash,
      updated_at: new Date()
    });

    console.log("\n✅ Password updated successfully!");

    // Verify the new password works
    const verifyUser = await FederalAdmin.findOne({ 
      where: { email } 
    });
    
    const verifyPassword = await bcrypt.compare(newPassword, verifyUser.password);
    console.log(`\n🔐 Password verification: ${verifyPassword ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (verifyPassword) {
      console.log("\n✅ FIX COMPLETE! You can now login with:");
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

fixFederalAdminPassword();