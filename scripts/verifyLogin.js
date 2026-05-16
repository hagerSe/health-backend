import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";

async function verifyLogin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const email = "agerneshdereje55@gmail.com";
    const password = "555555";

    // Get the hospital admin
    const [admin] = await sequelize.query(`
      SELECT id, email, first_name, last_name, hospital_name, password, status
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
    
    console.log("\n📋 Hospital Admin Status:");
    console.log("   ───────────────────────────");
    console.log(`   📧 Email: ${adminData.email}`);
    console.log(`   👤 Name: ${adminData.first_name} ${adminData.last_name}`);
    console.log(`   🏥 Hospital: ${adminData.hospital_name}`);
    console.log(`   📊 Account Status: ${adminData.status}`);
    console.log(`   🔐 Password Hash: ${adminData.password.substring(0, 30)}...`);
    console.log(`   📏 Hash Length: ${adminData.password.length}`);
    console.log("   ───────────────────────────");

    // Test the password
    const isMatch = await bcrypt.compare(password, adminData.password);
    console.log(`   🔑 Login Test with "${password}": ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log("   ───────────────────────────");
    
    if (isMatch) {
      console.log("\n🎉 SUCCESS! You can now login with:");
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${password}`);
      console.log(`   🌐 Dashboard: http://localhost:3000/hospital-dashboard`);
      console.log(`   👤 User Type: hospital`);
    } else {
      console.log("\n❌ Something went wrong. Password still doesn't match.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyLogin();