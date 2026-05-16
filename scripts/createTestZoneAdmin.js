import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";

async function createTestZoneAdmin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Find a regional admin to associate with
    const regional = await RegionalAdmin.findOne({
      where: { email: "agerneshdereje52@gmail.com" } // Use your regional admin email
    });
    
    if (!regional) {
      console.log("❌ No regional admin found. Please check the email.");
      
      // List all regional admins
      const allRegionals = await RegionalAdmin.findAll({
        attributes: ['id', 'email', 'first_name', 'last_name', 'region_name']
      });
      
      console.log("\n📋 Available regional admins:");
      allRegionals.forEach(reg => {
        console.log(`   - ${reg.email} (${reg.first_name} ${reg.last_name}) - ${reg.region_name}`);
      });
      
      process.exit(1);
    }

    console.log(`📝 Creating test zone admin for regional: ${regional.email} (${regional.region_name})`);

    const testEmail = "zone.test@nhms.gov.et";
    const testPassword = "Admin@123";

    // Check if already exists
    const existing = await ZoneAdmin.findOne({
      where: { email: testEmail }
    });

    if (existing) {
      console.log("⚠️ Test zone admin already exists with email:", testEmail);
      
      // Test the password
      const bcrypt = (await import("bcryptjs")).default;
      const isMatch = await bcrypt.compare(testPassword, existing.password);
      console.log(`   Password "${testPassword}": ${isMatch ? '✅ WORKS' : '❌ FAILS'}`);
      
      if (!isMatch) {
        console.log("\n🔄 Resetting password...");
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(testPassword, salt);
        await existing.update({ password: hashedPassword });
        console.log("✅ Password reset to:", testPassword);
      }
      
      process.exit(0);
    }

    // Create new zone admin
    const zoneAdmin = await ZoneAdmin.create({
      regional_id: regional.id,
      zone_name: "Test Zone",
      first_name: "Test",
      middle_name: "Zone",
      last_name: "Admin",
      gender: "Male",
      age: 35,
      email: testEmail,
      password: testPassword, // Will be hashed by model hook
      phone: "0912345678",
      role: "Zone_Admin",
      status: "active"
    });
    
    console.log("✅ Test zone admin created successfully!");
    console.log("📧 Email:", testEmail);
    console.log("🔑 Password:", testPassword);
    console.log("📍 Zone:", "Test Zone");
    console.log("👤 Regional:", regional.email);

    // Verify the password works
    const bcrypt = (await import("bcryptjs")).default;
    const verifyMatch = await bcrypt.compare(testPassword, zoneAdmin.password);
    console.log(`\n🔑 Password verification: ${verifyMatch ? '✅ SUCCESS' : '❌ FAILED'}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createTestZoneAdmin();