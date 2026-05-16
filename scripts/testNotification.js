import sequelize from "../config/database.js";
import Notification from "../models/Notification.js";

async function testNotification() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    
    // Try to create a test notification
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    const testNotif = await Notification.create({
      notification_number: `TEST-${year}${month}${day}-${random}`,
      title: "Test Notification",
      message: "This is a test notification",
      type: "info",
      priority: "low",
      recipient_id: 1,
      recipient_type: "zone",
      recipient_name: "Test User"
    });
    
    console.log("✅ Test notification created:", testNotif.notification_number);
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testNotification();