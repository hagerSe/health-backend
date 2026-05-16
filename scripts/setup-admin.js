import bcrypt from 'bcryptjs';
import sequelize from './config/database.js';

const setupAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database: project_db');

    // Check if federal_admins table exists
    const [tableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'federal_admins'
      )
    `);
    
    if (!tableExists[0].exists) {
      console.log('📋 Creating federal_admins table...');
      await sequelize.query(`
        CREATE TABLE federal_admins (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          middle_name VARCHAR(100),
          last_name VARCHAR(100) NOT NULL,
          gender VARCHAR(20),
          age INTEGER,
          phone VARCHAR(50),
          role VARCHAR(50) DEFAULT 'federal',
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('✅ Table created');
    } else {
      console.log('✅ federal_admins table already exists');
    }

    // Generate password hash for 'agi123'
    const hashedPassword = await bcrypt.hash('agi123', 10);
    console.log('✅ Password hash generated');

    // Insert or update admin
    const [result] = await sequelize.query(
      `INSERT INTO federal_admins 
       (email, password, first_name, middle_name, last_name, gender, age, phone, role, status, created_at, updated_at)
       VALUES ('ager@gmail.com', $1, 'Federal', 'Admin', 'User', 'Male', 35, '0911123456', 'federal', 'active', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET 
         password = EXCLUDED.password,
         updated_at = NOW()
       RETURNING id, email`,
      {
        bind: [hashedPassword],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (result) {
      console.log('\n' + '='.repeat(50));
      console.log('✅ ADMIN SETUP SUCCESSFUL!');
      console.log('='.repeat(50));
      console.log('📧 Email:    ager@gmail.com');
      console.log('🔑 Password: agi123');
      console.log('🆔 ID:       ' + result.id);
      console.log('='.repeat(50));
      
      // Verify the password works
      const verifyMatch = await bcrypt.compare('agi123', hashedPassword);
      console.log('🔐 Password verification test:', verifyMatch ? '✅ PASSED' : '❌ FAILED');
      
      // Show the user from database
      const [user] = await sequelize.query(
        `SELECT id, email, first_name, last_name, role, status FROM federal_admins WHERE email = 'ager@gmail.com'`,
        { type: sequelize.QueryTypes.SELECT }
      );
      console.log('\n📋 User in database:');
      console.log(user);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

setupAdmin();