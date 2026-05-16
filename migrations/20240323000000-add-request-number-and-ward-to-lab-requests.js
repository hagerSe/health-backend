// backend/migrations/20240323000000-add-request-number-and-ward-to-lab-requests.js
export default {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('lab_requests');
    
    // Add request_number column as nullable first
    if (!tableInfo.request_number) {
      await queryInterface.addColumn('lab_requests', 'request_number', {
        type: Sequelize.STRING,
        allowNull: true  // First make it nullable
      });
      
      // Generate request numbers for existing rows
      const labRequests = await queryInterface.sequelize.query(
        'SELECT id FROM lab_requests WHERE request_number IS NULL',
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      for (const request of labRequests) {
        const requestNumber = `LAB-${Date.now()}-${request.id}`;
        await queryInterface.sequelize.query(
          `UPDATE lab_requests SET request_number = '${requestNumber}' WHERE id = ${request.id}`
        );
      }
      
      // Now make it NOT NULL and UNIQUE
      await queryInterface.changeColumn('lab_requests', 'request_number', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      });
    }
    
    // Add ward column as nullable first
    if (!tableInfo.ward) {
      await queryInterface.addColumn('lab_requests', 'ward', {
        type: Sequelize.STRING,
        allowNull: true  // First make it nullable
      });
      
      // Set default ward for existing rows (you can change this default)
      await queryInterface.sequelize.query(
        `UPDATE lab_requests SET ward = 'OPD' WHERE ward IS NULL`
      );
      
      // Now make it NOT NULL
      await queryInterface.changeColumn('lab_requests', 'ward', {
        type: Sequelize.STRING,
        allowNull: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lab_requests', 'request_number');
    await queryInterface.removeColumn('lab_requests', 'ward');
  }
};