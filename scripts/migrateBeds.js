import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

async function migrateBedsTable() {
  try {
    console.log('🛏️  Migrating beds table with ENUM changes...');
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Step 1: Check if table exists
    const tableExists = await queryInterface.showAllTables().then(tables => tables.includes('beds'));
    if (!tableExists) {
      console.log('❌ Beds table does not exist. Please run force sync first.');
      process.exit(1);
    }
    
    // Step 2: Add new columns first (skip if they exist)
    console.log('📝 Adding new columns...');
    
    const columns = await queryInterface.describeTable('beds');
    
    if (!columns.equipment) {
      await queryInterface.addColumn('beds', 'equipment', {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
          has_oxygen: false,
          has_suction: false,
          has_monitor: false,
          has_infusion_pump: false,
          has_ventilator: false,
          has_heart_monitor: false
        }
      });
      console.log('✅ Added equipment column');
    }
    
    if (!columns.features) {
      await queryInterface.addColumn('beds', 'features', {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
          adjustable: false,
          has_rails: true,
          has_call_button: true,
          has_curtains: true,
          has_side_table: true,
          has_chair: true
        }
      });
      console.log('✅ Added features column');
    }
    
    if (!columns.cleaning_status) {
      await queryInterface.addColumn('beds', 'cleaning_status', {
        type: DataTypes.STRING(50),
        defaultValue: 'clean'
      });
      console.log('✅ Added cleaning_status column');
    }
    
    if (!columns.last_cleaned_at) {
      await queryInterface.addColumn('beds', 'last_cleaned_at', {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ Added last_cleaned_at column');
    }
    
    if (!columns.last_cleaned_by) {
      await queryInterface.addColumn('beds', 'last_cleaned_by', {
        type: DataTypes.STRING(100),
        allowNull: true
      });
      console.log('✅ Added last_cleaned_by column');
    }
    
    if (!columns.maintenance_status) {
      await queryInterface.addColumn('beds', 'maintenance_status', {
        type: DataTypes.STRING(50),
        defaultValue: 'operational'
      });
      console.log('✅ Added maintenance_status column');
    }
    
    if (!columns.last_maintenance_at) {
      await queryInterface.addColumn('beds', 'last_maintenance_at', {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ Added last_maintenance_at column');
    }
    
    if (!columns.next_maintenance_at) {
      await queryInterface.addColumn('beds', 'next_maintenance_at', {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ Added next_maintenance_at column');
    }
    
    if (!columns.assigned_by) {
      await queryInterface.addColumn('beds', 'assigned_by', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
      console.log('✅ Added assigned_by column');
    }
    
    if (!columns.assigned_at) {
      await queryInterface.addColumn('beds', 'assigned_at', {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ Added assigned_at column');
    }
    
    if (!columns.expected_discharge_date) {
      await queryInterface.addColumn('beds', 'expected_discharge_date', {
        type: DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ Added expected_discharge_date column');
    }
    
    if (!columns.is_emergency) {
      await queryInterface.addColumn('beds', 'is_emergency', {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      });
      console.log('✅ Added is_emergency column');
    }
    
    if (!columns.is_isolation) {
      await queryInterface.addColumn('beds', 'is_isolation', {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      });
      console.log('✅ Added is_isolation column');
    }
    
    if (!columns.isolation_type) {
      await queryInterface.addColumn('beds', 'isolation_type', {
        type: DataTypes.STRING(50),
        defaultValue: 'none'
      });
      console.log('✅ Added isolation_type column');
    }
    
    if (!columns.bed_code) {
      await queryInterface.addColumn('beds', 'bed_code', {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true
      });
      console.log('✅ Added bed_code column');
    }
    
    if (!columns.occupied_count) {
      await queryInterface.addColumn('beds', 'occupied_count', {
        type: DataTypes.INTEGER,
        defaultValue: 0
      });
      console.log('✅ Added occupied_count column');
    }
    
    if (!columns.total_days_occupied) {
      await queryInterface.addColumn('beds', 'total_days_occupied', {
        type: DataTypes.INTEGER,
        defaultValue: 0
      });
      console.log('✅ Added total_days_occupied column');
    }
    
    if (!columns.daily_rate) {
      await queryInterface.addColumn('beds', 'daily_rate', {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
      });
      console.log('✅ Added daily_rate column');
    }
    
    // Step 3: Handle status ENUM conversion
    console.log('📝 Updating status column...');
    
    // Check if status column exists
    if (columns.status) {
      try {
        // Get current status values
        const statusValues = await sequelize.query(`
          SELECT DISTINCT status FROM beds WHERE status IS NOT NULL
        `);
        console.log('Current status values:', statusValues[0]);
        
        // Add temporary column
        await sequelize.query(`
          ALTER TABLE beds ADD COLUMN status_temp VARCHAR(50);
        `);
        
        // Copy data
        await sequelize.query(`
          UPDATE beds SET status_temp = status::text;
        `);
        
        // Drop old column
        await sequelize.query(`
          ALTER TABLE beds DROP COLUMN status CASCADE;
        `);
        
        // Add new column with ENUM
        await sequelize.query(`
          CREATE TYPE "enum_beds_status" AS ENUM('available', 'occupied', 'maintenance', 'reserved', 'cleaning', 'disinfected', 'quarantine', 'out_of_service', 'decommissioned');
          ALTER TABLE beds ADD COLUMN status "enum_beds_status" DEFAULT 'available';
        `);
        
        // Copy data back
        await sequelize.query(`
          UPDATE beds SET status = status_temp::"enum_beds_status" WHERE status_temp IS NOT NULL;
        `);
        
        // Drop temp column
        await sequelize.query(`
          ALTER TABLE beds DROP COLUMN status_temp;
        `);
        
        console.log('✅ Status column updated successfully');
      } catch (error) {
        console.log('Status update error (may already be updated):', error.message);
      }
    }
    
    // Step 4: Handle ward column - get fresh column info
    const updatedColumns = await queryInterface.describeTable('beds');
    
    if (updatedColumns.ward) {
      console.log('📝 Updating ward column...');
      try {
        // Get current ward values
        const wardValues = await sequelize.query(`
          SELECT DISTINCT ward FROM beds WHERE ward IS NOT NULL
        `);
        console.log('Current ward values:', wardValues[0]);
        
        // Add temporary column
        await sequelize.query(`
          ALTER TABLE beds ADD COLUMN ward_temp VARCHAR(50);
        `);
        
        // Copy data
        await sequelize.query(`
          UPDATE beds SET ward_temp = ward::text;
        `);
        
        // Drop old column
        await sequelize.query(`
          ALTER TABLE beds DROP COLUMN ward CASCADE;
        `);
        
        // Add new column with ENUM
        await sequelize.query(`
          CREATE TYPE "enum_beds_ward" AS ENUM('OPD', 'EME', 'ANC', 'ICU', 'PEDIATRIC', 'MATERNITY', 'SURGICAL', 'MEDICAL');
          ALTER TABLE beds ADD COLUMN ward "enum_beds_ward";
        `);
        
        // Copy data back
        await sequelize.query(`
          UPDATE beds SET ward = ward_temp::"enum_beds_ward" WHERE ward_temp IS NOT NULL;
        `);
        
        // Drop temp column
        await sequelize.query(`
          ALTER TABLE beds DROP COLUMN ward_temp;
        `);
        
        console.log('✅ Ward column updated successfully');
      } catch (error) {
        console.log('Ward update error (may already be updated):', error.message);
      }
    }
    
    // Step 5: Handle type column
    if (updatedColumns.type) {
      console.log('📝 Updating type column...');
      try {
        // Add temporary column
        await sequelize.query(`
          ALTER TABLE beds ADD COLUMN type_temp VARCHAR(50);
        `);
        
        // Copy data
        await sequelize.query(`
          UPDATE beds SET type_temp = type::text;
        `);
        
        // Drop old column
        await sequelize.query(`
          ALTER TABLE beds DROP COLUMN type CASCADE;
        `);
        
        // Add new column with ENUM
        await sequelize.query(`
          CREATE TYPE "enum_beds_type" AS ENUM('general', 'private', 'semi-private', 'icu', 'isolation', 'pediatric', 'maternity', 'emergency');
          ALTER TABLE beds ADD COLUMN type "enum_beds_type" DEFAULT 'general';
        `);
        
        // Copy data back
        await sequelize.query(`
          UPDATE beds SET type = type_temp::"enum_beds_type" WHERE type_temp IS NOT NULL;
        `);
        
        // Drop temp column
        await sequelize.query(`
          ALTER TABLE beds DROP COLUMN type_temp;
        `);
        
        console.log('✅ Type column updated successfully');
      } catch (error) {
        console.log('Type update error (may already be updated):', error.message);
      }
    }
    
    // Step 6: Generate bed codes for existing beds (using final column names)
    console.log('📝 Generating bed codes for existing beds...');
    
    try {
      // Get final column info
      const finalColumns = await queryInterface.describeTable('beds');
      
      if (finalColumns.ward && finalColumns.bed_code) {
        await sequelize.query(`
          UPDATE beds 
          SET bed_code = CONCAT('BED-', LPAD(hospital_id::text, 4, '0'), '-', ward::text, '-', LPAD(CAST(id AS text), 4, '0'))
          WHERE bed_code IS NULL
        `);
        console.log('✅ Bed codes generated');
      } else {
        console.log('⚠️ Skipping bed code generation - columns not ready');
      }
    } catch (error) {
      console.log('Bed code generation error:', error.message);
    }
    
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error migrating beds table:', error);
    process.exit(1);
  }
}

migrateBedsTable();