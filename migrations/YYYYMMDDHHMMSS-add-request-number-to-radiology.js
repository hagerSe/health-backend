// migrations/YYYYMMDDHHMMSS-add-request-number-to-radiology.js
export default {
  up: async (queryInterface, Sequelize) => {
    // Add column as nullable first
    await queryInterface.addColumn('radiology_requests', 'request_number', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
    
    // Generate request numbers for existing rows
    const requests = await queryInterface.sequelize.query(
      'SELECT id FROM radiology_requests WHERE request_number IS NULL',
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    for (const req of requests) {
      const requestNumber = `RAD-${Date.now()}-${req.id}`;
      await queryInterface.sequelize.query(
        `UPDATE radiology_requests SET request_number = '${requestNumber}' WHERE id = ${req.id}`
      );
    }
    
    // Now make it NOT NULL
    await queryInterface.changeColumn('radiology_requests', 'request_number', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('radiology_requests', 'request_number');
  }
};