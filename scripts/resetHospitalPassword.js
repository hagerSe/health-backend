import sequelize from "../config/database.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import bcrypt from "bcryptjs";

async function resetHospitalPassword() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    const email = "agerneshdereje55@gmail.com";
    const newPassword = "555555";

    console.log(`\n🔧 Resetting password for: ${email}`);
    console.log(`   New password: ${newPassword}`);

    // Find the hospital admin
    const admin = await HospitalAdmin.findOne({
      where: { email }
    });

    if (!admin) {
      console.log(`\n❌ Hospital admin not found with email: ${email}`);
      
      // List all hospital admins
      const allAdmins = await HospitalAdmin.findAll({
        attributes: ['id', 'email', 'first_name', 'last_name', 'hospital_name']
      });
      
      if (allAdmins.length > 0) {
        console.log("\n📋 Available hospital admins:");
        allAdmins.forEach(a => {
          console.log(`   - ${a.email} (${a.first_name} ${a.last_name}) - ${a.hospital_name}`);
        });
      } else {
        console.log("\n📋 No hospital admins found in the database.");
        console.log("   Please run createSpecificHospitalAdmin.js first.");
      }
      
      process.exit(1);
    }

    console.log(`\n👤 Found admin: ${admin.first_name} ${admin.last_name}`);
    console.log(`   Hospital: ${admin.hospital_name}`);
    console.log(`   Current password hash length: ${admin.password.length}`);

    // Hash the new password
    console.log("\n🔐 Hashing new password...");
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the password
    await admin.update({ 
      password: hashedPassword,
      status: 'active' 
    });
    
    console.log("✅ Password updated in database");

    // Verify the new password works
    console.log("\n🔑 Verifying new password...");
    const verifyMatch = await bcrypt.compare(newPassword, admin.password);
    
    if (verifyMatch) {
      console.log(`   ✅ Password verification: SUCCESS`);
      console.log("\n📋 Login Credentials:");
      console.log("   ───────────────────────────");
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${newPassword}`);
      console.log("   ───────────────────────────");
      console.log("\n🎉 You can now login with these credentials!");
      console.log("   Dashboard URL: http://localhost:3000/hospital-dashboard");
    } else {
      console.log(`   ❌ Password verification: FAILED`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

resetHospitalPassword();