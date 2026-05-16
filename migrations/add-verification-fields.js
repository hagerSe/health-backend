import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

const tables = [
    'federal_admins',
    'regional_admins', 
    'zone_admins',
    'woreda_admins',
    'kebele_admins',
    'hospital_admins',
    'hospital_staff'
];

async function addVerificationFields() {
    try {
        for (const table of tables) {
            console.log(`📝 Adding fields to ${table}...`);
            
            // Check if table exists
            const [results] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '${table}'
                );
            `);
            
            if (results[0].exists) {
                // Add is_verified column
                await sequelize.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
                `);
                
                // Add verification_token column
                await sequelize.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN IF NOT EXISTS verification_token TEXT;
                `);
                
                // Add verification_token_expires column
                await sequelize.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;
                `);
                
                // Add reset_password_token column
                await sequelize.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
                `);
                
                // Add reset_password_expires column
                await sequelize.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
                `);
                
                // Add last_login column
                await sequelize.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
                `);
                
                console.log(`✅ Added fields to ${table}`);
            } else {
                console.log(`⚠️ Table ${table} does not exist, skipping...`);
            }
        }
        
        console.log('\n🎉 All migrations completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

addVerificationFields();