// migrations/XXXXXXXXXXXXXX-add-hr-fields-to-hospital-staff.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('hospital_staff', 'max_hours_per_week', {
      type: Sequelize.INTEGER,
      defaultValue: 40
    });
    
    await queryInterface.addColumn('hospital_staff', 'skills', {
      type: Sequelize.JSONB,
      defaultValue: []
    });
    
    await queryInterface.addColumn('hospital_staff', 'shift_preferences', {
      type: Sequelize.JSONB,
      defaultValue: {
        morning: true,
        afternoon: true,
        night: false
      }
    });
    
    await queryInterface.addColumn('hospital_staff', 'total_hours_this_week', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });
    
    await queryInterface.addColumn('hospital_staff', 'last_shift_date', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    
    await queryInterface.addColumn('hospital_staff', 'last_shift_type', {
      type: Sequelize.ENUM('morning', 'afternoon', 'night'),
      allowNull: true
    });
    
    await queryInterface.addColumn('hospital_staff', 'qualifications', {
      type: Sequelize.JSONB,
      defaultValue: []
    });
    
    await queryInterface.addColumn('hospital_staff', 'years_of_experience', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });
    
    await queryInterface.addColumn('hospital_staff', 'preferred_days_off', {
      type: Sequelize.JSONB,
      defaultValue: []
    });
    
    await queryInterface.addColumn('hospital_staff', 'emergency_contact', {
      type: Sequelize.JSONB,
      defaultValue: {
        name: null,
        phone: null,
        relationship: null
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('hospital_staff', 'max_hours_per_week');
    await queryInterface.removeColumn('hospital_staff', 'skills');
    await queryInterface.removeColumn('hospital_staff', 'shift_preferences');
    await queryInterface.removeColumn('hospital_staff', 'total_hours_this_week');
    await queryInterface.removeColumn('hospital_staff', 'last_shift_date');
    await queryInterface.removeColumn('hospital_staff', 'last_shift_type');
    await queryInterface.removeColumn('hospital_staff', 'qualifications');
    await queryInterface.removeColumn('hospital_staff', 'years_of_experience');
    await queryInterface.removeColumn('hospital_staff', 'preferred_days_off');
    await queryInterface.removeColumn('hospital_staff', 'emergency_contact');
  }
};