import sequelize from "../config/database.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";

async function createHospitalWithModel() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Find a kebele admin using the model
    const kebele = await KebeleAdmin.findOne();
    
    if (!kebele) {
      console.log("❌ No kebele admin found. Please create a kebele admin first.");
      process.exit(1);
    }

    console.log(`\n📝 Using kebele admin:`);
    console.log(`   ID: ${kebele.id}`);
    console.log(`   Name: ${kebele.first_name} ${kebele.last_name}`);
    console.log(`   Kebele: ${kebele.kebele_name}`);

    const email = "agerneshdereje55@gmail.com";
    const password = "555555";

    console.log(`\n🔧 Creating hospital admin using model (auto-hashing):`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

    // Check if already exists
    const existing = await HospitalAdmin.findOne({
      where: { email }
    });

    if (existing) {
      console.log("\n⚠️ Hospital admin already exists. Updating password...");
      
      // Update using the model - this will trigger the beforeUpdate hook
      existing.password = password; // Will be hashed by the hook
      existing.status = 'active';
      await existing.save();
      
      console.log("✅ Password updated with model hook!");
    } else {
      // Create using the model - this will trigger the beforeCreate hook
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
        email: email,
        password: password, // Will be hashed by the model hook
        phone: "0912345678",
        role: "Hospital_Admin",
        status: "active"
      });
      
      console.log("✅ Hospital admin created with model hook!");
    }

    // Verify the password works
    const admin = await HospitalAdmin.findOne({
      where: { email },
      attributes: { include: ['password'] }
    });

    const bcrypt = (await import("bcryptjs")).default;
    const isMatch = await bcrypt.compare(password, admin.password);
    
    console.log("\n📋 Hospital Admin Created:");
    console.log("   ───────────────────────────");
    console.log(`   🆔 ID: ${admin.id}`);
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   👤 Name: ${admin.first_name} ${admin.last_name}`);
    console.log(`   🏥 Hospital: ${admin.hospital_name}`);
    console.log(`   📊 Status: ${admin.status}`);
    console.log("   ───────────────────────────");
    console.log(`   🔑 Password test with "${password}": ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log("   ───────────────────────────");
    
    if (isMatch) {
      console.log("\n🎉 SUCCESS! You can now login with:");
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${password}`);
      console.log(`   🌐 Dashboard: http://localhost:3000/hospital-dashboard`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createHospitalWithModel();