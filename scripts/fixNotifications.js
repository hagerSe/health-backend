import sequelize from "../config/database.js";
import Notification from "../models/Notification.js";

async function fixNotifications() {
  try {
    console.log("🔧 Fixing notifications table...");
    
    // Find all notifications with null notification_number
    const [results] = await sequelize.query(`
      SELECT id, "createdAt" FROM notifications WHERE notification_number IS NULL
    `);
    
    console.log(`📊 Found ${results.length} notifications with null notification_number`);
    
    // Update each one with a generated number
    for (let i = 0; i < results.length; i++) {
      const notif = results[i];
      const date = notif.createdAt ? new Date(notif.createdAt) : new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const notificationNumber = `NOT-${year}${month}${day}-${random}`;
      
      await sequelize.query(`
        UPDATE notifications 
        SET notification_number = '${notificationNumber}' 
        WHERE id = ${notif.id}
      `);
      
      console.log(`✅ Updated notification ${notif.id} with ${notificationNumber}`);
    }
    
    // Now alter the column to be NOT NULL if it isn't already
    await sequelize.query(`
      ALTER TABLE notifications 
      ALTER COLUMN notification_number SET NOT NULL
    `);
    
    console.log("✅ All notifications fixed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing notifications:", error);
    process.exit(1);
  }
}

fixNotifications();