import bcrypt from 'bcryptjs';
import sequelize from './config/database.js';
import HospitalStaff from './models/HospitalStaff.js';

async function resetPassword() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Staff email and new password
    const email = 'agerneshdereje08@gmail.com';
    const newPassword = '080808';

    // Find the staff member
    const staff = await HospitalStaff.findOne({ where: { email } });

    if (!staff) {
      console.log('❌ Staff not found with email:', email);
      return;
    }

    console.log('✅ Staff found:');
    console.log('   Name:', staff.first_name, staff.last_name);
    console.log('   Department:', staff.department);
    console.log('   Current password hash:', staff.password.substring(0, 30) + '...\n');

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    staff.password = hashedPassword;
    await staff.save();

    console.log('✅ PASSWORD RESET SUCCESSFUL!');
    console.log('   Email:', email);
    console.log('   New Password:', newPassword);
    console.log('\n🔐 You can now login with:');
    console.log('   Email:', email);
    console.log('   Password:', newPassword);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

resetPassword();