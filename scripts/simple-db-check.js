import sequelize from "./config/database.js";

const simpleCheck = async () => {
  try {
    console.log("1. Testing database connection...");
    await sequelize.authenticate();
    console.log("✅ Database connected\n");
    
    console.log("2. Running raw SQL query...");
    const [results] = await sequelize.query(`
      SELECT * FROM federal_admins WHERE email = 'ager@gmail.com'
    `);
    
    console.log(`3. Results found: ${results.length}`);
    
    if (results.length > 0) {
      console.log("\n✅ FEDERAL ADMIN FOUND!");
      console.log("=".repeat(40));
      console.log(`Email: ${results[0].email}`);
      console.log(`Name: ${results[0].first_name} ${results[0].last_name}`);
      console.log(`Role: ${results[0].role}`);
      console.log(`Status: ${results[0].status}`);
      console.log("=".repeat(40));
    } else {
      console.log("\n❌ NO FEDERAL ADMIN FOUND with email: ager@gmail.com");
      
      // Check if any federal admins exist
      const [allAdmins] = await sequelize.query(`
        SELECT email, first_name, last_name FROM federal_admins LIMIT 5
      `);
      
      if (allAdmins.length > 0) {
        console.log(`\n📊 Other admins in database (${allAdmins.length}):`);
        allAdmins.forEach(admin => {
          console.log(`   - ${admin.email} (${admin.first_name} ${admin.last_name})`);
        });
      } else {
        console.log("\n📊 No federal admins found at all in the database!");
      }
    }
    
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error("\nFull error details:", error);
  } finally {
    await sequelize.close();
    console.log("\n✅ Database connection closed");
  }
};

simpleCheck();