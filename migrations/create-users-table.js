import sequelize from "../config/database.js";

const createUsersTable = async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        last_name VARCHAR(100) NOT NULL,
        gender VARCHAR(10),
        age INTEGER,
        phone VARCHAR(20),
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        federal_id INTEGER,
        federal_name VARCHAR(100),
        region_id INTEGER,
        region_name VARCHAR(100),
        zone_id INTEGER,
        zone_name VARCHAR(100),
        woreda_id INTEGER,
        woreda_name VARCHAR(100),
        kebele_id INTEGER,
        kebele_name VARCHAR(100),
        hospital_id INTEGER,
        hospital_name VARCHAR(200),
        service_type VARCHAR(20) DEFAULT 'Public',
        hospital_type VARCHAR(50),
        address TEXT,
        website VARCHAR(200),
        established_year INTEGER,
        bed_capacity INTEGER,
        accreditation VARCHAR(100),
        department VARCHAR(50),
        ward VARCHAR(50),
        employee_id VARCHAR(50) UNIQUE,
        specialization VARCHAR(100),
        bio TEXT,
        profile_picture VARCHAR(500),
        languages JSONB DEFAULT '[]',
        max_hours_per_week INTEGER DEFAULT 40,
        skills JSONB DEFAULT '[]',
        shift_preferences JSONB DEFAULT '{"morning": true, "afternoon": true, "night": false}',
        total_hours_this_week INTEGER DEFAULT 0,
        last_shift_date DATE,
        last_shift_type VARCHAR(20),
        qualifications JSONB DEFAULT '[]',
        years_of_experience INTEGER DEFAULT 0,
        preferred_days_off JSONB DEFAULT '[]',
        emergency_contact JSONB DEFAULT '{"name": null, "phone": null, "relationship": null}',
        available_for_scheduling BOOLEAN DEFAULT true,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        is_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        verification_token_expires TIMESTAMP,
        reset_password_token TEXT,
        reset_password_expires TIMESTAMP,
        last_login TIMESTAMP,
        last_password_change TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_hospital_id ON users(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
      CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);
    `);
    
    console.log("✅ Users table created successfully!");
  } catch (error) {
    console.error("❌ Error creating users table:", error);
  } finally {
    await sequelize.close();
  }
};

createUsersTable();