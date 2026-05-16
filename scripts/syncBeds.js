import sequelize from '../config/database.js';
import Bed from '../models/Bed.js';

async function syncBedsTable() {
  try {
    console.log('🛏️  Syncing beds table...');
    console.log('⚠️  This will add new columns but preserve existing data');
    
    // Sync only the beds table with alter: true
    await Bed.sync({ alter: true });
    
    console.log('✅ Beds table updated successfully!');
    console.log('New columns added:');
    console.log('  - equipment (JSON)');
    console.log('  - features (JSON)');
    console.log('  - cleaning_status (ENUM)');
    console.log('  - last_cleaned_at (DATE)');
    console.log('  - last_cleaned_by (STRING)');
    console.log('  - maintenance_status (ENUM)');
    console.log('  - last_maintenance_at (DATE)');
    console.log('  - next_maintenance_at (DATE)');
    console.log('  - assigned_by (INTEGER)');
    console.log('  - assigned_at (DATE)');
    console.log('  - expected_discharge_date (DATE)');
    console.log('  - is_emergency (BOOLEAN)');
    console.log('  - is_isolation (BOOLEAN)');
    console.log('  - isolation_type (ENUM)');
    console.log('  - bed_code (STRING)');
    console.log('  - occupied_count (INTEGER)');
    console.log('  - total_days_occupied (INTEGER)');
    console.log('  - daily_rate (DECIMAL)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing beds table:', error);
    process.exit(1);
  }
}

syncBedsTable();