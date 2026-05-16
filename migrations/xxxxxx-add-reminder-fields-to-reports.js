// migrations/xxxxxx-add-reminder-fields-to-reports.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('reports', 'reminder_date', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_time', {
      type: Sequelize.TIME,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_frequency', {
      type: Sequelize.ENUM('none', 'once', 'daily', 'weekly', 'monthly'),
      defaultValue: 'none'
    });
    
    await queryInterface.addColumn('reports', 'reminder_sent', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });
    
    await queryInterface.addColumn('reports', 'reminder_sent_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    await queryInterface.addColumn('reports', 'reminder_message', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('reports', 'reminder_date');
    await queryInterface.removeColumn('reports', 'reminder_time');
    await queryInterface.removeColumn('reports', 'reminder_frequency');
    await queryInterface.removeColumn('reports', 'reminder_sent');
    await queryInterface.removeColumn('reports', 'reminder_sent_at');
    await queryInterface.removeColumn('reports', 'reminder_message');
  }
};
