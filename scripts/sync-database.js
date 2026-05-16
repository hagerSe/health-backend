// scripts/sync-database.js
import sequelize from '../config/database.js';
import '../models/index.js';

async function syncDatabase() {
  try {
    console.log('🔄 Starting database sync...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Sync all models (use { alter: true } for development)
    // This will update tables without dropping data
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced successfully');
    
    console.log('\n📊 Tables synced:');
    console.log('   - patients (updated with prescriptions_history)');
    console.log('   - prescriptions (created if not exists)');
    console.log('   - lab_requests');
    console.log('   - radiology_requests');
    console.log('   - etc...');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

syncDatabase();