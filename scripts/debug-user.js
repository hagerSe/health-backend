// debug-user.js
import FederalAdmin from './models/FederalAdmin.js';
import sequelize from './config/database.js';

const debug = async () => {
  await sequelize.authenticate();
  
  const users = await FederalAdmin.findAll({
    attributes: ['id', 'email', 'role', 'status']
  });
  
  console.log("📋 All Federal Admins:");
  users.forEach(user => {
    console.log(`- ${user.email} (${user.role}) - Status: ${user.status}`);
  });
  
  process.exit();
};

debug();