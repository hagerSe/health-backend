// migrations/XXXXXXXXXXXXXX-add-discharge-columns-to-patients.cjs
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add discharge columns
    try {
      await queryInterface.addColumn('patients', 'discharge_location', {
        type: Sequelize.STRING,
        allowNull: true
      });
      console.log('✅ Added discharge_location column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharge_location column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharged_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
      console.log('✅ Added discharged_at column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharged_at column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharged_by', {
        type: Sequelize.STRING,
        allowNull: true
      });
      console.log('✅ Added discharged_by column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharged_by column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharged_by_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
      console.log('✅ Added discharged_by_id column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharged_by_id column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharge_notes', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Added discharge_notes column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharge_notes column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharge_diagnosis', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added discharge_diagnosis column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharge_diagnosis column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharge_prescriptions', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added discharge_prescriptions column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharge_prescriptions column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharge_lab_results', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added discharge_lab_results column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharge_lab_results column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'discharge_signature', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Added discharge_signature column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ discharge_signature column already exists');
    }
    
    // Add admission columns
    try {
      await queryInterface.addColumn('patients', 'bed_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
      console.log('✅ Added bed_id column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ bed_id column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admitted_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
      console.log('✅ Added admitted_at column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admitted_at column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admitted_by', {
        type: Sequelize.STRING,
        allowNull: true
      });
      console.log('✅ Added admitted_by column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admitted_by column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admitted_by_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
      console.log('✅ Added admitted_by_id column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admitted_by_id column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admission_notes', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Added admission_notes column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admission_notes column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admission_diagnosis', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added admission_diagnosis column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admission_diagnosis column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admission_prescriptions', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added admission_prescriptions column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admission_prescriptions column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admission_lab_results', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added admission_lab_results column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admission_lab_results column already exists');
    }
    
    try {
      await queryInterface.addColumn('patients', 'admission_signature', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Added admission_signature column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ admission_signature column already exists');
    }
    
    // Add referral column
    try {
      await queryInterface.addColumn('patients', 'referral_data', {
        type: Sequelize.JSONB,
        allowNull: true
      });
      console.log('✅ Added referral_data column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ referral_data column already exists');
    }
    
    // Add prescriptions column
    try {
      await queryInterface.addColumn('patients', 'prescriptions', {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false
      });
      console.log('✅ Added prescriptions column');
    } catch (error) {
      if (!error.message.includes('already exists')) throw error;
      console.log('⏭️ prescriptions column already exists');
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove columns (for rollback)
    const columnsToRemove = [
      'discharge_location', 'discharged_at', 'discharged_by', 'discharged_by_id',
      'discharge_notes', 'discharge_diagnosis', 'discharge_prescriptions',
      'discharge_lab_results', 'discharge_signature', 'bed_id', 'admitted_at',
      'admitted_by', 'admitted_by_id', 'admission_notes', 'admission_diagnosis',
      'admission_prescriptions', 'admission_lab_results', 'admission_signature',
      'referral_data', 'prescriptions'
    ];
    
    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn('patients', column);
        console.log(`✅ Removed column: ${column}`);
      } catch (error) {
        console.log(`⚠️ Could not remove column: ${column}`, error.message);
      }
    }
  }
};