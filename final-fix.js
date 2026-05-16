import bcrypt from "bcryptjs";
import sequelize from "./config/database.js";
import FederalAdmin from "./models/FederalAdmin.js";

const finalFix = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected\n");
    
    // Get the federal admin
    const admin = await FederalAdmin.findOne({
      where: { email: "ager@gmail.com" }
    });
    
    if (!admin) {
      console.log("❌ Admin not found!");
      return;
    }
    
    console.log("📧 Found admin:", admin.email);
    console.log("🔑 Current hash:", admin.password);
    console.log("📏 Hash length:", admin.password.length);
    
    // Test the password
    const testPassword = "agi123";
    console.log("\n🔐 Testing password:", testPassword);
    
    let isValid = false;
    try {
      isValid = await bcrypt.compare(testPassword, admin.password);
      console.log("Result:", isValid ? "✅ MATCH" : "❌ NO MATCH");
    } catch (err) {
      console.log("Error comparing:", err.message);
    }
    
    if (!isValid) {
      console.log("\n⚠️ Password doesn't match! Creating new hash...");
      
      // Create a brand new hash
      const newHash = await bcrypt.hash("agi123", 10);
      console.log("New hash:", newHash);
      
      // Update the database
      admin.password = newHash;
      await admin.save();
      console.log("✅ Password updated in database!");
      
      // Verify the new hash
      const verifyMatch = await bcrypt.compare("agi123", admin.password);
      console.log("Verification after update:", verifyMatch ? "✅ SUCCESS" : "❌ FAILED");
      
      if (verifyMatch) {
        console.log("\n🎉 SUCCESS! Login should now work!");
        console.log("=================================");
        console.log("Email: ager@gmail.com");
        console.log("Password: agi123");
        console.log("=================================");
      }
    } else {
      console.log("\n✅ Password is correct! Login should work!");
      console.log("But if it's not working, restart your backend server.");
    }
    
    // Also check if there's any issue with the model's field names
    console.log("\n📋 Admin record details:");
    console.log("  ID:", admin.id);
    console.log("  Email:", admin.email);
    console.log("  First name:", admin.first_name);
    console.log("  Last name:", admin.last_name);
    console.log("  Status:", admin.status);
    console.log("  Role:", admin.role);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
};

finalFix();