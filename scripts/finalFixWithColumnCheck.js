// scripts/finalFixWithColumnCheck.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";
import { QueryTypes } from "sequelize";

const finalFix = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // 1. First, check the actual column definition
    console.log("\n📊 Checking database column...");
    const columns = await sequelize.query(
      "SHOW COLUMNS FROM federal_admins WHERE Field = 'password'",
      { type: QueryTypes.SELECT }
    );
    console.log("Password column definition:", columns[0]);

    const email = "ager@gmail.com";
    const password = "agi123";

    // 2. Get the current user
    const user = await FederalAdmin.findOne({ where: { email } });
    
    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("\n📌 Current user:", user.email, "ID:", user.id);

    // 3. Create hash with explicit string conversion
    console.log("\n🔐 Creating new password hash...");
    const hash = await bcrypt.hash(password, 10);
    console.log("Hash created:", hash);
    console.log("Hash length:", hash.length);
    console.log("Hash type:", typeof hash);

    // 4. Verify hash works in memory
    const verifyInMemory = await bcrypt.compare(password, hash);
    console.log(`In-memory verification: ${verifyInMemory ? '✅' : '❌'}`);

    if (!verifyInMemory) {
      console.log("❌ Hash creation failed");
      return;
    }

    // 5. Try different update methods
    
    // Method A: Direct SQL update
    console.log("\n📝 Method A: Direct SQL update...");
    await sequelize.query(
      "UPDATE federal_admins SET password = ?, updated_at = NOW() WHERE email = ?",
      {
        replacements: [hash, email],
        type: QueryTypes.UPDATE
      }
    );
    console.log("✅ SQL update executed");

    // Verify after SQL update
    const afterSQL = await FederalAdmin.findOne({ 
      where: { email },
      attributes: ['id', 'email', 'password']
    });
    
    const verifySQL = await bcrypt.compare(password, afterSQL.password);
    console.log(`After SQL update verification: ${verifySQL ? '✅' : '❌'}`);

    if (!verifySQL) {
      console.log("⚠️ SQL update failed verification");
      
      // Method B: Try with explicit string
      console.log("\n📝 Method B: Update with explicit string...");
      await user.update({ 
        password: String(hash),
        updated_at: new Date()
      });
      
      const afterModel = await FederalAdmin.findOne({ where: { email } });
      const verifyModel = await bcrypt.compare(password, afterModel.password);
      console.log(`After model update verification: ${verifyModel ? '✅' : '❌'}`);
    }

    // 6. Check the actual stored value
    console.log("\n🔍 Checking stored value in database:");
    const result = await sequelize.query(
      `SELECT 
        id, 
        email, 
        password,
        HEX(password) as password_hex,
        LENGTH(password) as char_length
      FROM federal_admins 
      WHERE email = ?`,
      {
        replacements: [email],
        type: QueryTypes.SELECT
      }
    );

    if (result.length > 0) {
      console.log("Stored password:", result[0].password);
      console.log("Password HEX:", result[0].password_hex);
      console.log("Character length:", result[0].char_length);
      
      // 7. Final verification with the stored value
      const finalVerify = await bcrypt.compare(password, result[0].password);
      console.log(`\n🔐 FINAL VERIFICATION: ${finalVerify ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    // 8. If still failing, fix column type
    if (!verifySQL) {
      console.log("\n🔄 Fixing column data type...");
      
      // Alter column to TEXT type
      await sequelize.query(
        "ALTER TABLE federal_admins MODIFY COLUMN password TEXT NOT NULL",
        { type: QueryTypes.RAW }
      );
      console.log("✅ Column type changed to TEXT");
      
      // Try update again
      await sequelize.query(
        "UPDATE federal_admins SET password = ?, updated_at = NOW() WHERE email = ?",
        {
          replacements: [hash, email],
          type: QueryTypes.UPDATE
        }
      );
      
      // Final verification
      const finalResult = await sequelize.query(
        "SELECT password FROM federal_admins WHERE email = ?",
        {
          replacements: [email],
          type: QueryTypes.SELECT
        }
      );
      
      const finalCheck = await bcrypt.compare(password, finalResult[0].password);
      console.log(`\n🔐 AFTER COLUMN FIX: ${finalCheck ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

finalFix();
