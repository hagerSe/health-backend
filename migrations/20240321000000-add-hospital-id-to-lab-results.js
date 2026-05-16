// backend/migrations/20240321000000-add-hospital-id-to-lab-results.js
export default {
  up: async (queryInterface, Sequelize) => {
    // Check if column exists and add if not
    const tableInfo = await queryInterface.describeTable('lab_results');
    
    if (!tableInfo.hospital_id) {
      await queryInterface.addColumn('lab_results', 'hospital_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'hospital_admins',
          key: 'id'
        }
      });
    }
    
    if (!tableInfo.doctor_id) {
      await queryInterface.addColumn('lab_results', 'doctor_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'hospital_staff',
          key: 'id'
        }
      });
    }
    
    if (!tableInfo.doctor_name) {
      await queryInterface.addColumn('lab_results', 'doctor_name', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    
    if (!tableInfo.recommendations) {
      await queryInterface.addColumn('lab_results', 'recommendations', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lab_results', 'hospital_id');
    await queryInterface.removeColumn('lab_results', 'doctor_id');
    await queryInterface.removeColumn('lab_results', 'doctor_name');
    await queryInterface.removeColumn('lab_results', 'recommendations');
  }
};