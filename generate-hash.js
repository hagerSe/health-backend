import bcrypt from 'bcryptjs';

// Password is 101010
const newPassword = '101010';

const hash = bcrypt.hashSync(newPassword, 10);
console.log('=================================');
console.log('Password:', newPassword);
console.log('Hash:', hash);
console.log('=================================');
console.log('\n📋 Copy this SQL to Neon:\n');
console.log(`UPDATE "hospital_admins" 
SET password = '${hash}' 
WHERE email = 'agerneshdereje10@gmail.com';\n`);