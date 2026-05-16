import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";

async function createHospitalSimple() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // First, find a kebele admin
    const [kebeles] = await sequelize.query(`
      SELECT id, email, kebele_name FROM kebele_admins LIMIT 1
    `);

    if (!kebeles || kebeles.length === 0) {
      console.log("❌ No kebele admin found. Please create a kebele admin first.");
      process.exit(1);
    }

    const kebele = kebeles[0];
    console.log(`📝 Using kebele admin: ${kebele.email} (${kebele.kebele_name})`);

    const email = "agerneshdereje55@gmail.com";
    const password = "555555";

    console.log(`\n🔧 Creating hospital admin:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if already exists
    const [existing] = await sequelize.query(`
      SELECT id FROM hospital_admins WHERE email = $1
    `, {
      bind: [email]
    });

    if (existing.length > 0) {
      console.log("\n⚠️ Hospital admin already exists. Updating password...");
      
      await sequelize.query(`
        UPDATE hospital_admins 
        SET password = $1, status = 'active', "updatedAt" = NOW()
        WHERE email = $2
      `, {
        bind: [hashedPassword, email]
      });
      
      console.log("✅ Password updated successfully!");
    } else {
      // Create new hospital admin
      await sequelize.query(`
        INSERT INTO hospital_admins 
        (kebele_id, hospital_name, service_type, hospital_type, first_name, middle_name, last_name, gender, age, email, password, phone, role, status, "createdAt", "updatedAt") 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      `, {
        bind: [
          kebele.id,
          "General Hospital",
          "Public",
          "General",
          "Agernesh",
          "Dereje",
          "55",
          "Female",
          35,
          email,
          hashedPassword,
          "0912345678",
          "Hospital_Admin",
          "active"
        ]
      });
      
      console.log("\n✅ Hospital admin created successfully!");
    }

    // Verify the password works
    const [admin] = await sequelize.query(`
      SELECT * FROM hospital_admins WHERE email = $1
    `, {
      bind: [email],
      type: sequelize.QueryTypes.SELECT
    });

    const isMatch = await bcrypt.compare(password, admin.password);
    
    console.log("\n📋 Login Credentials:");
    console.log("   ───────────────────────────");
    console.log(`   📧 Email: ${email}`);
    console.log(`   🔑 Password: ${password}`);
    console.log(`   ───────────────────────────`);
    console.log(`   🔑 Password verification: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createHospitalSimple();