import sequelize from "./config/database.js";
import FederalAdmin from "./models/FederalAdmin.js";

const directCheck = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected\n");
    
    // Check ALL federal admins
    const allAdmins = await FederalAdmin.findAll();
    console.log(`📊 Total federal admins in database: ${allAdmins.length}\n`);
    
    if (allAdmins.length === 0) {
      console.log("⚠️ NO federal admins found!");
      console.log("\nCreating federal admin now...\n");
      
      // Import and run seeder directly
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash("agi123", 10);
      
      const newAdmin = await FederalAdmin.create({
        email: "ager@gmail.com",
        password: hashedPassword,
        first_name: "Federal",
        middle_name: "Admin",
        last_name: "User",
        gender: "Male",
        age: 35,
        phone: "0911123456",
        role: "federal",
        status: "active"
      });
      
      console.log("✅ Federal admin created!");
      console.log(`   ID: ${newAdmin.id}`);
      console.log(`   Email: ${newAdmin.email}`);
    } else {
      allAdmins.forEach(admin => {
        console.log(`Admin: ${admin.email} - ${admin.first_name} ${admin.last_name}`);
      });
      
      // Check specifically for ager@gmail.com
      const specificAdmin = await FederalAdmin.findOne({
        where: { email: "ager@gmail.com" }
      });
      
      if (specificAdmin) {
        console.log("\n✅ FOUND ager@gmail.com in database!");
      } else {
        console.log("\n❌ ager@gmail.com NOT found!");
        console.log("But other admins exist:", allAdmins.map(a => a.email).join(", "));
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
};

directCheck();