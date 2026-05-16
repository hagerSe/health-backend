// scripts/fixPostgresPassword.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";
import { QueryTypes } from "sequelize";

const fixPostgresPassword = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected to PostgreSQL");

    const email = "ager@gmail.com";
    const password = "agi123";

    // 1. Check PostgreSQL column information
    console.log("\n📊 Checking PostgreSQL column...");
    const columns = await sequelize.query(
      `SELECT 
        column_name, 
        data_type, 
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'federal_admins' 
      AND column_name = 'password'`,
      { type: QueryTypes.SELECT }
    );
    console.log("Password column info:", columns[0] || "Column not found");

    // 2. Get current user
    const user = await FederalAdmin.findOne({ where: { email } });
    
    if (!user) {
      console.log("❌ User not found with email:", email);
      
      // Create user if not exists
      console.log("\n🔄 Creating new user...");
      const hash = await bcrypt.hash(password, 10);
      
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
      console.log(`Password verification: ${verify ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (verify) {
        console.log("\n✅ FIX COMPLETE! Login with:");
        console.log("=".repeat(40));
        console.log("Email:    ager@gmail.com");
        console.log("Password: agi123");
        console.log("=".repeat(40));
      }
      return;
    }

    console.log("\n📌 Current user found:");
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Current hash length:", user.password.length);

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

    // 5. Update using different methods

    // Method 1: Sequelize update
    console.log("\n📝 Method 1: Sequelize update...");
    await user.update({ 
      password: newHash,
      updated_at: new Date()
    });
    
    const afterSequelize = await FederalAdmin.findOne({ where: { email } });
    const verifySequelize = await bcrypt.compare(password, afterSequelize.password);
    console.log(`Sequelize update verification: ${verifySequelize ? '✅' : '❌'}`);

    if (!verifySequelize) {
      // Method 2: Raw SQL update
      console.log("\n📝 Method 2: Raw SQL update...");
      await sequelize.query(
        `UPDATE federal_admins 
         SET password = $1, updated_at = NOW() 
         WHERE email = $2`,
        {
          bind: [newHash, email],
          type: QueryTypes.UPDATE
        }
      );
      
      const afterSQL = await FederalAdmin.findOne({ where: { email } });
      const verifySQL = await bcrypt.compare(password, afterSQL.password);
      console.log(`Raw SQL update verification: ${verifySQL ? '✅' : '❌'}`);
    }

    // 6. Check stored value in PostgreSQL
    console.log("\n🔍 Checking stored value in PostgreSQL:");
    const result = await sequelize.query(
      `SELECT 
        id, 
        email, 
        password,
        length(password) as pwd_length,
        encode(password::bytea, 'hex') as password_hex
      FROM federal_admins 
      WHERE email = $1`,
      {
        bind: [email],
        type: QueryTypes.SELECT
      }
    );

    if (result.length > 0) {
      console.log("Stored password:", result[0].password);
      console.log("Password length:", result[0].pwd_length);
      console.log("Password HEX (first 50 chars):", result[0].password_hex?.substring(0, 50) + "...");
      
      // Final verification
      const finalVerify = await bcrypt.compare(password, result[0].password);
      console.log(`\n🔐 FINAL VERIFICATION: ${finalVerify ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (finalVerify) {
        console.log("\n✅ FIX COMPLETE! Login with:");
        console.log("=".repeat(40));
        console.log("Email:    ager@gmail.com");
        console.log("Password: agi123");
        console.log("=".repeat(40));
      } else {
        console.log("\n❌ Still failing. Let's try extreme measure...");
        
        // Method 3: Delete and recreate
        console.log("\n🔄 Deleting and recreating user...");
        await FederalAdmin.destroy({ where: { email } });
        
        const finalHash = await bcrypt.hash(password, 10);
        const finalUser = await FederalAdmin.create({
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
        
        const finalCheck = await bcrypt.compare(password, finalUser.password);
        console.log(`Recreated user verification: ${finalCheck ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        if (finalCheck) {
          console.log("\n✅ FIX COMPLETE! Login with:");
          console.log("=".repeat(40));
          console.log("Email:    ager@gmail.com");
          console.log("Password: agi123");
          console.log("=".repeat(40));
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

fixPostgresPassword();