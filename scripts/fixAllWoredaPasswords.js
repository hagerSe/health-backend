// scripts/fixAllWoredaPasswords.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import WoredaAdmin from "../models/WoredaAdmin.js";

const fixAllWoredaPasswords = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to PostgreSQL");

    // Find all woreda admins
    const allAdmins = await WoredaAdmin.findAll();
    console.log(`📊 Found ${allAdmins.length} woreda admins`);

    let fixed = 0;
    let skipped = 0;

    for (const admin of allAdmins) {
      const currentPassword = admin.password;
      
      // Check if password is already hashed (bcrypt hashes start with $2b$ and are 60 chars)
      const isHashed = currentPassword.startsWith('$2b$') && currentPassword.length === 60;
      
      if (!isHashed) {
        console.log(`\n🔄 Fixing admin: ${admin.email}`);
        console.log(`   Current (plain text): ${currentPassword}`);
        
        // Hash the plain text password
        const hashedPassword = await bcrypt.hash(currentPassword, 10);
        
        // Update
        await admin.update({ 
          password: hashedPassword,
          updatedAt: new Date()
        });
        
        // Verify
        const verify = await bcrypt.compare(currentPassword, hashedPassword);
        console.log(`   New hash: ${hashedPassword.substring(0, 30)}...`);
        console.log(`   Verification: ${verify ? '✅' : '❌'}`);
        
        fixed++;
      } else {
        console.log(`\n⏭️ Skipping ${admin.email} - already hashed`);
        skipped++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ FIX COMPLETE!");
    console.log(`   Fixed: ${fixed} admins`);
    console.log(`   Skipped: ${skipped} admins (already hashed)`);
    console.log("=".repeat(50));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

fixAllWoredaPasswords();