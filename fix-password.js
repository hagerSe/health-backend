import bcrypt from 'bcryptjs';
import sequelize from './config/database.js';
import HospitalStaff from './models/HospitalStaff.js';

async function fixPassword() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    const email = 'agerneshdereje08@gmail.com';
    const desiredPassword = '080808';

    console.log(`🔍 Looking for staff: ${email}`);
    const staff = await HospitalStaff.findOne({ where: { email } });

    if (!staff) {
      console.log('❌ Staff not found!');
      return;
    }

    console.log('✅ Staff found!');
    console.log(`   Name: ${staff.first_name} ${staff.last_name}`);
    console.log(`   Department: ${staff.department}`);
    console.log(`   Old hash: ${staff.password}\n`);

    // Generate new hash for '080808'
    const newHash = await bcrypt.hash(desiredPassword, 10);
    
    // Update the password
    staff.password = newHash;
    await staff.save();

    console.log('✅ PASSWORD SUCCESSFULLY CHANGED!');
    console.log('='.repeat(50));
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${desiredPassword}`);
    console.log(`   New hash: ${newHash}`);
    console.log('='.repeat(50));
    console.log('\n🔐 NOW TRY LOGGING IN WITH:');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${desiredPassword}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

fixPassword();