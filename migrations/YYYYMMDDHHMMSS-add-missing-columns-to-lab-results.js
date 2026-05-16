// backend/migrations/YYYYMMDDHHMMSS-add-missing-columns-to-lab-results.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if hospital_id column exists and add if not
    const tableInfo = await queryInterface.describeTable('lab_results');
    
    if (!tableInfo.hospital_id) {
      await queryInterface.addColumn('lab_results', 'hospital_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      });
    }

    if (!tableInfo.doctor_id) {
      await queryInterface.addColumn('lab_results', 'doctor_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      });
    }

    if (!tableInfo.doctor_name) {
      await queryInterface.addColumn('lab_results', 'doctor_name', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Unknown'
      });
    }

    if (!tableInfo.normal_range) {
      await queryInterface.addColumn('lab_results', 'normal_range', {
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
    await queryInterface.removeColumn('lab_results', 'normal_range');
    await queryInterface.removeColumn('lab_results', 'recommendations');
  }
};