// scripts/finalPostgresFix.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";
import { QueryTypes } from "sequelize";

const finalPostgresFix = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to PostgreSQL");

    const email = "ager@gmail.com";
    const password = "agi123";

    // 1. First, let's see the table structure
    console.log("\n📊 Checking table structure...");
    const tableInfo = await sequelize.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'federal_admins'
       ORDER BY ordinal_position`,
      { type: QueryTypes.SELECT }
    );
    
    console.log("Columns in federal_admins table:");
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 2. Get current user
    const user = await FederalAdmin.findOne({ where: { email } });
    
    if (!user) {
      console.log("❌ User not found with email:", email);
      return;
    }

    console.log("\n📌 Current user:");
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Current hash:", user.password);
    console.log("Hash length:", user.password.length);

    // 3. Test current password
    const currentValid = await bcrypt.compare(password, user.password);
    console.log(`Current password valid: ${currentValid ? '✅' : '❌'}`);

    // 4. Create new hash
    console.log("\n🔐 Creating new password hash...");
    const newHash = await bcrypt.hash(password, 10);
    console.log("New hash:", newHash);
    
    // Verify in memory
    const memoryValid = await bcrypt.compare(password, newHash);
    console.log(`Memory verification: ${memoryValid ? '✅' : '❌'}`);

    if (!memoryValid) {
      console.log("❌ Hash creation failed");
      return;
    }

    // 5. Try different update methods with correct column names

    // Method 1: Sequelize update (should work with model defaults)
    console.log("\n📝 Method 1: Sequelize model update...");
    try {
      await user.update({ 
        password: newHash
        // updatedAt will be auto-updated by Sequelize
      });
      
      const afterModel = await FederalAdmin.findOne({ where: { email } });
      const verifyModel = await bcrypt.compare(password, afterModel.password);
      console.log(`Model update verification: ${verifyModel ? '✅' : '❌'}`);
    } catch (err) {
      console.log("Model update failed:", err.message);
    }

    // Method 2: Raw SQL with correct column name (updatedAt)
    console.log("\n📝 Method 2: Raw SQL update with updatedAt...");
    try {
      await sequelize.query(
        `UPDATE federal_admins 
         SET password = $1, "updatedAt" = NOW() 
         WHERE email = $2`,
        {
          bind: [newHash, email],
          type: QueryTypes.UPDATE
        }
      );
      
      const afterSQL = await FederalAdmin.findOne({ where: { email } });
      const verifySQL = await bcrypt.compare(password, afterSQL.password);
      console.log(`Raw SQL update verification: ${verifySQL ? '✅' : '❌'}`);
    } catch (err) {
      console.log("Raw SQL update failed:", err.message);
      
      // Try without updatedAt
      console.log("\n📝 Method 3: Raw SQL without timestamp...");
      await sequelize.query(
        `UPDATE federal_admins 
         SET password = $1
         WHERE email = $2`,
        {
          bind: [newHash, email],
          type: QueryTypes.UPDATE
        }
      );
      
      const afterSimple = await FederalAdmin.findOne({ where: { email } });
      const verifySimple = await bcrypt.compare(password, afterSimple.password);
      console.log(`Simple SQL update verification: ${verifySimple ? '✅' : '❌'}`);
    }

    // 6. Final verification
    const finalUser = await FederalAdmin.findOne({ where: { email } });
    const finalVerify = await bcrypt.compare(password, finalUser.password);
    
    console.log("\n🔐 FINAL VERIFICATION:");
    console.log("=".repeat(50));
    console.log(`Password works: ${finalVerify ? '✅ YES' : '❌ NO'}`);
    
    if (finalVerify) {
      console.log("\n✅ SUCCESS! You can now login with:");
      console.log("Email:    ager@gmail.com");
      console.log("Password: agi123");
    } else {
      console.log("\n❌ Still failing. Let's try nuclear option...");
      
      // Nuclear option: Delete and recreate
      console.log("\n💣 Nuclear option: Delete and recreate user...");
      
      await FederalAdmin.destroy({ where: { email } });
      console.log("✅ User deleted");
      
      const finalHash = await bcrypt.hash(password, 10);
      const newUser = await FederalAdmin.create({
        email: email,
        password: finalHash,
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
      
      const recreateVerify = await bcrypt.compare(password, newUser.password);
      console.log(`New user password test: ${recreateVerify ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (recreateVerify) {
        console.log("\n✅ FIX COMPLETE! Login with:");
        console.log("=".repeat(40));
        console.log("Email:    ager@gmail.com");
        console.log("Password: agi123");
        console.log("=".repeat(40));
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

finalPostgresFix();