'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add reminder fields to reports table
    await queryInterface.addColumn('reports', 'reminder_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_time', {
      type: Sequelize.TIME,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_frequency', {
      type: Sequelize.STRING(20),
      defaultValue: 'none',
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_sent', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_sent_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_message', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    
    // Drop license_number column if exists
    const tableDesc = await queryInterface.describeTable('hospital_staff');
    if (tableDesc.license_number) {
      await queryInterface.removeColumn('hospital_staff', 'license_number');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove reminder fields (rollback)
    await queryInterface.removeColumn('reports', 'reminder_date');
    await queryInterface.removeColumn('reports', 'reminder_time');
    await queryInterface.removeColumn('reports', 'reminder_frequency');
    await queryInterface.removeColumn('reports', 'reminder_sent');
    await queryInterface.removeColumn('reports', 'reminder_sent_at');
    await queryInterface.removeColumn('reports', 'reminder_message');
    
    // Re-add license_number if needed (optional)
    // await queryInterface.addColumn('hospital_staff', 'license_number', {
    //   type: Sequelize.STRING(50),
    //   allowNull: true
    // });
  }
};