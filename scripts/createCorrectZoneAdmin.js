import sequelize from "../config/database.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";

async function createCorrectZoneAdmin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Find the regional admin (using your known working email)
    const regional = await RegionalAdmin.findOne({
      where: { email: "agerneshdereje52@gmail.com" } // Your working regional admin
    });
    
    if (!regional) {
      console.log("❌ Regional admin not found");
      process.exit(1);
    }

    console.log(`📝 Creating zone admin for regional: ${regional.email}`);

    const testEmail = "zone.correct@nhms.gov.et";
    const testPassword = "Admin@123";

    // Check if already exists
    const existing = await ZoneAdmin.findOne({
      where: { email: testEmail }
    });

    if (existing) {
      console.log("⚠️ Zone admin already exists. Updating password...");
      
      // Hash password properly (ONCE)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      
      await existing.update({ password: hashedPassword });
      console.log("✅ Password updated");
    } else {
      // Create new zone admin - let the model hook hash it
      const zoneAdmin = await ZoneAdmin.create({
        regional_id: regional.id,
        zone_name: "Correct Zone",
        first_name: "Correct",
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
      
      console.log("✅ Zone admin created successfully!");
    }

    // Verify the password works
    const ZoneAdminModel = (await import("../models/ZoneAdmin.js")).default;
    const admin = await ZoneAdminModel.findOne({
      where: { email: testEmail }
    });
    
    const bcrypt = (await import("bcryptjs")).default;
    const isMatch = await bcrypt.compare(testPassword, admin.password);
    
    console.log(`\n📧 Email: ${testEmail}`);
    console.log(`🔑 Password: ${testPassword}`);
    console.log(`🔑 Verification: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createCorrectZoneAdmin();