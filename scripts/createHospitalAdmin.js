import sequelize from "../config/database.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import bcrypt from "bcryptjs";

async function createSpecificHospitalAdmin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Find any kebele admin to associate with
    const kebele = await KebeleAdmin.findOne();
    
    if (!kebele) {
      console.log("❌ No kebele admin found. Please create a kebele admin first.");
      console.log("\n📋 To create a kebele admin, you need:");
      console.log("   1. A woreda admin must exist");
      console.log("   2. Login as woreda admin and create a kebele admin");
      process.exit(1);
    }

    console.log(`📝 Using kebele admin: ${kebele.email} (${kebele.kebele_name})`);

    const testEmail = "agerneshdereje55@gmail.com";
    const testPassword = "555555";

    console.log(`\n🔧 Creating hospital admin with:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);

    // Check if already exists
    const existing = await HospitalAdmin.findOne({
      where: { email: testEmail }
    });

    if (existing) {
      console.log("\n⚠️ Hospital admin already exists. Updating password...");
      
      // Hash the new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      
      await existing.update({ 
        password: hashedPassword,
        status: 'active' 
      });
      
      console.log("✅ Password updated successfully!");
    } else {
      // Create new hospital admin
      const hospitalAdmin = await HospitalAdmin.create({
        kebele_id: kebele.id,
        hospital_name: "General Hospital",
        service_type: "Public",
        hospital_type: "General",
        first_name: "Agernesh",
        middle_name: "Dereje",
        last_name: "55",
        gender: "Female",
        age: 35,
        email: testEmail,
        password: testPassword, // Will be hashed by model hook
        phone: "0912345678",
        role: "Hospital_Admin",
        status: "active"
      });
      
      console.log("\n✅ Hospital admin created successfully!");
    }

    // Verify the password works
    const admin = await HospitalAdmin.findOne({
      where: { email: testEmail }
    });
    
    const isMatch = await bcrypt.compare(testPassword, admin.password);
    
    console.log("\n📋 Login Credentials:");
    console.log("   ───────────────────────────");
    console.log(`   📧 Email: ${testEmail}`);
    console.log(`   🔑 Password: ${testPassword}`);
    console.log(`   ───────────────────────────`);
    console.log(`   🔑 Password verification: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (isMatch) {
      console.log("\n🎉 You can now login with these credentials!");
      console.log("   Dashboard URL: http://localhost:3000/hospital-dashboard");
    } else {
      console.log("\n❌ Password verification failed. Please try again.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createSpecificHospitalAdmin();