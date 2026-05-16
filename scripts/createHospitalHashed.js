import sequelize from "../config/database.js";
import bcrypt from "bcryptjs";

async function createHospitalHashed() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // First, find a kebele admin
    const [kebeles] = await sequelize.query(`
      SELECT id, email, first_name, last_name, kebele_name 
      FROM kebele_admins 
      WHERE status = 'active' OR status IS NULL
      LIMIT 1
    `);

    if (!kebeles || kebeles.length === 0) {
      console.log("❌ No kebele admin found. Please create a kebele admin first.");
      process.exit(1);
    }

    const kebele = kebeles[0];
    console.log(`\n📝 Using kebele admin:`);
    console.log(`   ID: ${kebele.id}`);
    console.log(`   Name: ${kebele.first_name} ${kebele.last_name}`);
    console.log(`   Kebele: ${kebele.kebele_name}`);

    const email = "agerneshdereje55@gmail.com";
    const password = "555555";

    console.log(`\n🔧 Creating hospital admin with hashed password:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

    // IMPORTANT: Hash the password properly
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log(`   ✅ Password hashed: ${hashedPassword.substring(0, 30)}...`);
    console.log(`   Hash length: ${hashedPassword.length}`);

    // Check if already exists
    const [existing] = await sequelize.query(`
      SELECT id, email FROM hospital_admins WHERE email = $1
    `, {
      bind: [email]
    });

    if (existing.length > 0) {
      console.log("\n⚠️ Hospital admin already exists. Updating password with hash...");
      
      await sequelize.query(`
        UPDATE hospital_admins 
        SET password = $1, status = 'active', "updatedAt" = NOW()
        WHERE email = $2
      `, {
        bind: [hashedPassword, email]
      });
      
      console.log("✅ Password updated with proper hash!");
    } else {
      // Create new hospital admin with hashed password
      console.log("\n📝 Creating new hospital admin with hashed password...");
      
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
          hashedPassword, // Use the hashed password, not plain text
          "0912345678",
          "Hospital_Admin",
          "active"
        ]
      });
      
      console.log("✅ Hospital admin created with hashed password!");
    }

    // Verify the password works
    const [admin] = await sequelize.query(`
      SELECT id, email, first_name, last_name, hospital_name, status, password 
      FROM hospital_admins 
      WHERE email = $1
    `, {
      bind: [email]
    });

    const adminData = admin[0];
    
    // Test the password
    const isMatch = await bcrypt.compare(password, adminData.password);
    
    console.log("\n📋 Hospital Admin Created:");
    console.log("   ───────────────────────────");
    console.log(`   🆔 ID: ${adminData.id}`);
    console.log(`   📧 Email: ${adminData.email}`);
    console.log(`   👤 Name: ${adminData.first_name} ${adminData.last_name}`);
    console.log(`   🏥 Hospital: ${adminData.hospital_name}`);
    console.log(`   📊 Status: ${adminData.status}`);
    console.log(`   🔐 Stored hash: ${adminData.password.substring(0, 30)}...`);
    console.log("   ───────────────────────────");
    console.log(`   🔑 Password test with "${password}": ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log("   ───────────────────────────");
    
    if (isMatch) {
      console.log("\n🎉 SUCCESS! You can now login with:");
      console.log(`   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${password}`);
      console.log(`   🌐 Dashboard: http://localhost:3000/hospital-dashboard`);
    } else {
      console.log("\n❌ Password verification failed. Please check the hashing.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createHospitalHashed();