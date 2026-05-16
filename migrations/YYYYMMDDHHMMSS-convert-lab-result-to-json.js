// migrations/YYYYMMDDHHMMSS-convert-lab-result-to-json.js
export default {
  up: async (queryInterface, Sequelize) => {
    // First, ensure all existing data is valid JSON or convert it
    await queryInterface.sequelize.query(`
      UPDATE lab_results 
      SET result = '{"value": "' || result || '"}' 
      WHERE result IS NOT NULL AND result != '';
    `);
    
    // Then alter the column type with USING clause
    await queryInterface.sequelize.query(`
      ALTER TABLE lab_results 
      ALTER COLUMN result TYPE JSON 
      USING result::json;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE lab_results 
      ALTER COLUMN result TYPE TEXT;
    `);
  }
};