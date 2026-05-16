// migrations/xxxx-change-patient-id-to-bigint.js
export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('patients', 'id', {
      type: Sequelize.BIGINT,
      autoIncrement: true,
      primaryKey: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('patients', 'id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    });
  }
};