// scripts/fix-patient-registered-by.js
import sequelize from '../config/database.js';

async function fixPatientRegisteredBy() {
  try {
    console.log('🔧 Fixing patients registered_by column...');
    
    // Update existing NULL records
    await sequelize.query(`
      UPDATE patients 
      SET registered_by = 'System', 
          registered_by_id = 1 
      WHERE registered_by IS NULL OR registered_by_id IS NULL
    `);
    console.log('✅ Updated NULL records');
    
    // Check if any NULL remain
    const [nullCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM patients WHERE registered_by IS NULL
    `);
    console.log(`📊 Remaining NULL registered_by: ${nullCount[0].count}`);
    
    // Set NOT NULL constraint
    await sequelize.query(`
      ALTER TABLE patients 
      ALTER COLUMN registered_by SET NOT NULL,
      ALTER COLUMN registered_by SET DEFAULT 'System'
    `);
    console.log('✅ Set NOT NULL constraint on registered_by');
    
    await sequelize.query(`
      ALTER TABLE patients 
      ALTER COLUMN registered_by_id SET NOT NULL,
      ALTER COLUMN registered_by_id SET DEFAULT 1
    `);
    console.log('✅ Set NOT NULL constraint on registered_by_id');
    
    console.log('✅ All fixes applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixPatientRegisteredBy();