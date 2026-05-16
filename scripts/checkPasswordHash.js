import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";

async function checkPasswordHash() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const email = "agerneshdereje55@gmail.com";
    const testPassword = "555555";

    // Get the hospital admin
    const [admin] = await sequelize.query(`
      SELECT id, email, first_name, last_name, password 
      FROM hospital_admins 
      WHERE email = $1
    `, {
      bind: [email]
    });

    if (!admin || admin.length === 0) {
      console.log(`❌ No hospital admin found with email: ${email}`);
      process.exit(1);
    }

    const adminData = admin[0];
    
    console.log("\n📋 Hospital Admin Password Check:");
    console.log("   ───────────────────────────");
    console.log(`   📧 Email: ${adminData.email}`);
    console.log(`   👤 Name: ${adminData.first_name} ${adminData.last_name}`);
    console.log(`   🔐 Stored password hash: ${adminData.password}`);
    console.log(`   📏 Hash length: ${adminData.password.length}`);
    console.log("   ───────────────────────────");

    // Test if it's a valid bcrypt hash
    const isBcryptHash = adminData.password.startsWith('$2a$') || 
                         adminData.password.startsWith('$2b$') || 
                         adminData.password.startsWith('$2y$');
    
    console.log(`   🔍 Is valid bcrypt hash: ${isBcryptHash ? '✅ YES' : '❌ NO'}`);
    
    if (!isBcryptHash) {
      console.log("\n⚠️ The stored password is NOT a bcrypt hash. It's plain text!");
      console.log("   This is why login is failing.");
      
      // Fix it by hashing the password
      console.log("\n🔄 Fixing password...");
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      
      await sequelize.query(`
        UPDATE hospital_admins 
        SET password = $1, "updatedAt" = NOW()
        WHERE email = $2
      `, {
        bind: [hashedPassword, email]
      });
      
      console.log("✅ Password has been fixed!");
      
      // Verify the fix
      const isMatch = await bcrypt.compare(testPassword, hashedPassword);
      console.log(`   Verification: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    } else {
      // Test the password
      const isMatch = await bcrypt.compare(testPassword, adminData.password);
      console.log(`   🔑 Password "${testPassword}" matches: ${isMatch ? '✅ YES' : '❌ NO'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkPasswordHash();