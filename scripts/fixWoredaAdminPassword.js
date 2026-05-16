// scripts/fixWoredaAdminPassword.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import WoredaAdmin from "../models/WoredaAdmin.js"; // Adjust the import path as needed

const fixWoredaAdminPassword = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to PostgreSQL");

    const email = "agerneshdereje06@gmail.com";
    const plainPassword = "060606";

    // Find the woreda admin
    const admin = await WoredaAdmin.findOne({ 
      where: { email } 
    });

    if (!admin) {
      console.log("❌ Woreda admin not found with email:", email);
      return;
    }

    console.log("\n📌 Current woreda admin:");
    console.log("ID:", admin.id);
    console.log("Email:", admin.email);
    console.log("Current stored password:", admin.password);
    console.log("Current password length:", admin.password.length);

    // Create proper hash
    console.log("\n🔐 Creating proper password hash...");
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    console.log("New hash:", hashedPassword);
    console.log("New hash length:", hashedPassword.length);

    // Update with hashed password
    await admin.update({ 
      password: hashedPassword,
      updatedAt: new Date()
    });

    console.log("✅ Password updated successfully!");

    // Verify the new password works
    const updatedAdmin = await WoredaAdmin.findOne({ where: { email } });
    const verifyPassword = await bcrypt.compare(plainPassword, updatedAdmin.password);
    
    console.log(`\n🔐 Password verification: ${verifyPassword ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (verifyPassword) {
      console.log("\n✅ FIX COMPLETE! Woreda admin can now login with:");
      console.log("=".repeat(50));
      console.log("Email:    agerneshdereje06@gmail.com");
      console.log("Password: 060606");
      console.log("=".repeat(50));
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

fixWoredaAdminPassword();