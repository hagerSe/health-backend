// scripts/debugPasswordIssue.js
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import FederalAdmin from "../models/FederalAdmin.js";

const debugPasswordIssue = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const email = "ager@gmail.com";
    const password = "agi123";

    // 1. Get the user
    const user = await FederalAdmin.findOne({ 
      where: { email } 
    });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("\n📊 USER DETAILS:");
    console.log("=".repeat(50));
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Stored hash:", user.password);
    console.log("Hash length:", user.password.length);
    
    // 2. Test bcrypt directly
    console.log("\n🔬 TESTING BCRYPT DIRECTLY:");
    console.log("=".repeat(50));
    
    // Test 1: Compare with stored hash
    const test1 = await bcrypt.compare(password, user.password);
    console.log(`Test 1 (compare with stored): ${test1 ? '✅' : '❌'}`);
    
    // Test 2: Create new hash and compare
    const newHash = await bcrypt.hash(password, 10);
    console.log("New hash created:", newHash);
    console.log("New hash length:", newHash.length);
    
    const test2 = await bcrypt.compare(password, newHash);
    console.log(`Test 2 (compare with new hash): ${test2 ? '✅' : '❌'}`);
    
    // Test 3: Compare the two hashes (they should be different)
    console.log(`\nTest 3: Stored vs New hash (should be different): ${user.password !== newHash ? '✅ different' : '❌ same'}`);
    
    // 3. Try different salt rounds
    console.log("\n🔄 TESTING DIFFERENT SALT ROUNDS:");
    console.log("=".repeat(50));
    
    const saltRounds = [8, 10, 12, 14];
    for (const rounds of saltRounds) {
      const hash = await bcrypt.hash(password, rounds);
      const valid = await bcrypt.compare(password, hash);
      console.log(`Salt rounds ${rounds}: Hash starts with ${hash.substring(0, 7)}... - Compare: ${valid ? '✅' : '❌'}`);
    }
    
    // 4. Check if there's any hidden character in password
    console.log("\n🔍 CHECKING PASSWORD FORMAT:");
    console.log("=".repeat(50));
    console.log("Password length:", password.length);
    console.log("Password chars:", password.split('').map(c => c.charCodeAt(0)));
    
    // 5. Force update with verification
    console.log("\n🔄 FORCING PASSWORD UPDATE WITH VERIFICATION:");
    console.log("=".repeat(50));
    
    // Create hash with explicit salt rounds
    const salt = await bcrypt.genSalt(10);
    console.log("Generated salt:", salt);
    
    const forcedHash = await bcrypt.hash(password, salt);
    console.log("Forced hash:", forcedHash);
    
    // Verify immediately
    const forcedVerify = await bcrypt.compare(password, forcedHash);
    console.log(`Forced hash verification: ${forcedVerify ? '✅' : '❌'}`);
    
    if (forcedVerify) {
      // Update the database
      await user.update({ 
        password: forcedHash,
        updated_at: new Date()
      });
      console.log("✅ Database updated with verified hash");
      
      // Read back and verify
      const updatedUser = await FederalAdmin.findOne({ where: { email } });
      const finalVerify = await bcrypt.compare(password, updatedUser.password);
      console.log(`Final verification from DB: ${finalVerify ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

debugPasswordIssue();