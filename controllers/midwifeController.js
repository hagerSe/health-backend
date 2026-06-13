// controllers/midwifeController.js
import Patient from '../models/Patient.js';
import AntenatalVisit from '../models/AntenatalVisit.js';
import DeliveryRecord from '../models/DeliveryRecord.js';
import Report from '../models/Report.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

// ==================== PATIENT MANAGEMENT ====================

// @desc    Get all ANC patients for midwife
// @route   GET /api/midwife/patients
// @access  Private (Midwife)
export const getPatients = async (req, res) => {
  try {
    const { hospital_id, ward, midwife_id } = req.query;

    console.log(`👩‍⚕️ Fetching ANC patients for midwife: ${midwife_id}, hospital: ${hospital_id}`);

    const whereClause = {
      hospital_id: hospital_id,
      ward: 'ANC',
      status: {
        [Op.in]: ['in_anc', 'postnatal', 'delivered', 'admitted']
      }
    };

    if (midwife_id) {
      whereClause[Op.or] = [
        { midwife_id: midwife_id },
        { midwife_id: null }
      ];
    }

    const patients = await Patient.findAll({
      where: whereClause,
      order: [['triaged_at', 'ASC']]
    });

    const enhancedPatients = await Promise.all(patients.map(async (patient) => {
      const patientData = patient.toJSON();
      
      let latestVisit = null;
      try {
        latestVisit = await AntenatalVisit.findOne({
          where: { patient_id: patient.id },
          order: [['visit_date', 'DESC']]
        });
      } catch (error) {
        console.error('Error fetching latest visit:', error);
      }

      let deliveryRecord = null;
      try {
        deliveryRecord = await DeliveryRecord.findOne({
          where: { patient_id: patient.id }
        });
      } catch (error) {
        console.error('Error fetching delivery record:', error);
      }

      return {
        ...patientData,
        latest_visit: latestVisit,
        delivery_record: deliveryRecord,
        antenatal_data: patientData.antenatal_data || {}
      };
    }));

    res.json({
      success: true,
      patients: enhancedPatients
    });

  } catch (error) {
    console.error('Error fetching ANC patients:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get midwife statistics
// @route   GET /api/midwife/stats
// @access  Private (Midwife)
export const getStats = async (req, res) => {
  try {
    const { hospital_id, midwife_id } = req.query;

    console.log(`📊 Fetching midwife stats for: ${midwife_id}`);

    const antenatal = await Patient.count({
      where: {
        hospital_id,
        ward: 'ANC',
        status: 'in_anc',
        [Op.or]: [
          { midwife_id: midwife_id },
          { midwife_id: null }
        ]
      }
    });

    const postnatal = await Patient.count({
      where: {
        hospital_id,
        ward: 'ANC',
        status: 'postnatal',
        [Op.or]: [
          { midwife_id: midwife_id },
          { midwife_id: null }
        ]
      }
    });

    const deliveries = await Patient.count({
      where: {
        hospital_id,
        ward: 'ANC',
        status: 'delivered'
      }
    });

    let highRisk = 0;
    try {
      const [results] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM patients 
        WHERE hospital_id = :hospital_id 
        AND ward = 'ANC' 
        AND status = 'in_anc'
        AND (antenatal_data->>'high_risk')::boolean = true
      `, {
        replacements: { hospital_id: parseInt(hospital_id) },
        type: sequelize.QueryTypes.SELECT
      });
      highRisk = results?.count ? parseInt(results.count) : 0;
    } catch (error) {
      console.error('Error counting high risk patients:', error);
      highRisk = 0;
    }

    let dueThisWeek = 0;
    try {
      const [results] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM patients 
        WHERE hospital_id = :hospital_id 
        AND ward = 'ANC' 
        AND status = 'in_anc'
        AND (antenatal_data->>'edd') IS NOT NULL
        AND (DATE(antenatal_data->>'edd') - CURRENT_DATE) <= 7
        AND (DATE(antenatal_data->>'edd') - CURRENT_DATE) >= 0
      `, {
        replacements: { hospital_id: parseInt(hospital_id) },
        type: sequelize.QueryTypes.SELECT
      });
      dueThisWeek = results?.count ? parseInt(results.count) : 0;
    } catch (error) {
      console.error('Error counting due this week:', error);
      dueThisWeek = 0;
    }

    res.json({
      success: true,
      stats: {
        antenatal,
        postnatal,
        deliveries,
        highRisk,
        dueThisWeek,
        upcomingAppointments: 0,
        pendingPharmacy: 0,
        completedToday: 0
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.json({
      success: true,
      stats: {
        antenatal: 0,
        postnatal: 0,
        deliveries: 0,
        highRisk: 0,
        dueThisWeek: 0,
        upcomingAppointments: 0,
        pendingPharmacy: 0,
        completedToday: 0
      }
    });
  }
};

// @desc    Assign patient to midwife
// @route   POST /api/midwife/assign-patient
// @access  Private (Midwife)
export const assignPatient = async (req, res) => {
  try {
    const { patient_id, midwife_id, midwife_name, hospital_id } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    await patient.update({
      midwife_id,
      midwife_name,
      status: 'in_anc',
      consultation_started_at: new Date(),
      updatedAt: new Date()
    });

    const updatedPatient = await Patient.findByPk(patient_id);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_ward_ANC`).emit('midwife_assigned', {
        patient_id,
        midwife_id,
        midwife_name,
        ward: 'ANC'
      });
    }

    res.json({
      success: true,
      patient: updatedPatient
    });

  } catch (error) {
    console.error('Error assigning patient:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== ANTENATAL CARE ====================

// @desc    Save antenatal record
// @route   POST /api/midwife/save-antenatal
// @access  Private (Midwife)
export const saveAntenatalRecord = async (req, res) => {
  try {
    const { 
      patient_id, 
      antenatal_data, 
      vitals, 
      visit_notes,
      midwife_id,
      midwife_name,
      hospital_id 
    } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    let edd = antenatal_data.edd;
    if (!edd && antenatal_data.lmp) {
      const lmpDate = new Date(antenatal_data.lmp);
      const eddDate = new Date(lmpDate);
      eddDate.setDate(lmpDate.getDate() + 280);
      edd = eddDate.toISOString().split('T')[0];
      antenatal_data.edd = edd;
    }

    let gestational_weeks = antenatal_data.gestational_weeks;
    if (!gestational_weeks && antenatal_data.lmp) {
      const lmpDate = new Date(antenatal_data.lmp);
      const today = new Date();
      const diffTime = Math.abs(today - lmpDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      gestational_weeks = Math.floor(diffDays / 7);
      antenatal_data.gestational_weeks = gestational_weeks;
    }

    await patient.update({
      antenatal_data: {
        ...patient.antenatal_data,
        ...antenatal_data
      },
      vitals: {
        ...patient.vitals,
        ...vitals
      },
      updatedAt: new Date()
    });

    if (visit_notes.complaints || visit_notes.examination || visit_notes.advice) {
      await AntenatalVisit.create({
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        midwife_id,
        midwife_name,
        hospital_id,
        visit_date: new Date(),
        gestational_weeks: antenatal_data.gestational_weeks || gestational_weeks,
        complaints: visit_notes.complaints,
        examination: visit_notes.examination,
        advice: visit_notes.advice,
        next_appointment: visit_notes.next_appointment,
        vitals: vitals,
        created_at: new Date()
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`hospital_${hospital_id}_ward_ANC`).emit('new_antenatal_visit', {
          patient_id,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          visit_date: new Date(),
          gestational_weeks: antenatal_data.gestational_weeks
        });
      }
    }

    res.json({
      success: true,
      message: 'Antenatal record saved successfully',
      patient: {
        id: patient.id,
        antenatal_data: patient.antenatal_data,
        vitals: patient.vitals
      }
    });

  } catch (error) {
    console.error('Error saving antenatal record:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get antenatal visits for a patient
// @route   GET /api/midwife/antenatal-visits/:patientId
// @access  Private (Midwife)
export const getAntenatalVisits = async (req, res) => {
  try {
    const { patientId } = req.params;

    const visits = await AntenatalVisit.findAll({
      where: { patient_id: patientId },
      order: [['visit_date', 'DESC']]
    });

    res.json({
      success: true,
      visits: visits || []
    });

  } catch (error) {
    console.error('Error fetching antenatal visits:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== DELIVERY ====================

// @desc    Record delivery
// @route   POST /api/midwife/record-delivery
// @access  Private (Midwife)
export const recordDelivery = async (req, res) => {
  try {
    const { 
      patient_id,
      delivery_date,
      delivery_type,
      complications,
      baby_weight,
      baby_sex,
      apgar_score,
      notes,
      signature
    } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const deliveryRecord = await DeliveryRecord.create({
      patient_id,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      delivery_date: delivery_date || new Date(),
      delivery_type: delivery_type || 'vaginal',
      complications: complications || '',
      baby_weight: baby_weight || null,
      baby_sex: baby_sex || null,
      apgar_score: apgar_score || null,
      notes: notes || '',
      delivered_by: patient.midwife_name || 'Midwife',
      delivered_by_id: patient.midwife_id,
      signature: signature || null,
      created_at: new Date()
    });

    await patient.update({
      status: 'delivered',
      delivery_record_id: deliveryRecord.id,
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${patient.hospital_id}_ward_ANC`).emit('delivery_recorded', {
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        delivery_date: deliveryRecord.delivery_date,
        delivery_type: deliveryRecord.delivery_type
      });
    }

    res.json({
      success: true,
      message: 'Delivery recorded successfully',
      delivery: deliveryRecord
    });

  } catch (error) {
    console.error('Error recording delivery:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get delivery records
// @route   GET /api/midwife/deliveries
// @access  Private (Midwife)
export const getDeliveries = async (req, res) => {
  try {
    const { hospital_id, midwife_id } = req.query;

    const whereClause = {};
    
    if (midwife_id) {
      whereClause.delivered_by_id = midwife_id;
    }

    const deliveries = await DeliveryRecord.findAll({
      where: whereClause,
      order: [['delivery_date', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      deliveries: deliveries || []
    });

  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== DIAGNOSIS ====================

// @desc    Save diagnosis for patient
// @route   POST /api/midwife/save-diagnosis
// @access  Private (Midwife)
export const saveDiagnosis = async (req, res) => {
  try {
    const { 
      patient_id, 
      diagnosis,
      midwife_id, 
      hospital_id 
    } = req.body;

    console.log(`📋 Saving diagnosis for patient: ${patient_id}`);

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    await patient.update({
      diagnosis: diagnosis,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Diagnosis saved successfully',
      diagnosis: diagnosis
    });

  } catch (error) {
    console.error('Error saving diagnosis:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Update patient high risk status
// @route   PUT /api/midwife/update-risk-status/:patientId
// @access  Private (Midwife)
export const updateRiskStatus = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { high_risk, risk_factors } = req.body;

    const patient = await Patient.findByPk(patientId);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const antenatal_data = patient.antenatal_data || {};
    antenatal_data.high_risk = high_risk;
    antenatal_data.risk_factors = risk_factors || [];

    await patient.update({
      antenatal_data,
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io && high_risk) {
      io.to(`hospital_${patient.hospital_id}_ward_ANC`).emit('high_risk_alert', {
        patient_id: patient.id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        risk_factors: risk_factors
      });
    }

    res.json({
      success: true,
      message: `Risk status updated to ${high_risk ? 'High Risk' : 'Normal'}`,
      patient: {
        id: patient.id,
        antenatal_data
      }
    });

  } catch (error) {
    console.error('Error updating risk status:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== PRESCRIPTIONS ====================

// @desc    Save prescriptions
// @route   POST /api/midwife/save-prescriptions
// @access  Private (Midwife)
export const savePrescriptions = async (req, res) => {
  try {
    const { 
      patient_id, 
      patient_name,
      prescriptions,
      midwife_id, 
      midwife_name, 
      ward,
      hospital_id 
    } = req.body;

    console.log(`💊 Saving ${prescriptions.length} prescriptions for patient: ${patient_name}`);

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const updatedPrescriptions = prescriptions.map(p => ({
      ...p,
      prescribed_by: midwife_name,
      prescribed_by_id: midwife_id,
      prescribed_at: new Date(),
      status: 'sent'
    }));

    await patient.update({
      prescriptions: updatedPrescriptions,
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_pharmacy`).emit('new_prescriptions', {
        patient_id,
        patient_name,
        midwife_name,
        ward,
        prescriptions: updatedPrescriptions,
        sent_at: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Prescriptions sent to pharmacy successfully',
      prescriptions: updatedPrescriptions
    });

  } catch (error) {
    console.error('Error saving prescriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== LAB REQUESTS ====================

// @desc    Request lab test for patient
// @route   POST /api/midwife/request-lab
// @access  Private (Midwife)
export const requestLabTest = async (req, res) => {
  try {
    const { 
      patient_id, 
      patient_name,
      midwife_id, 
      midwife_name, 
      ward,
      hospital_id,
      testType,
      testName,
      priority,
      notes
    } = req.body;

    console.log(`🔬 Lab request for patient: ${patient_name}, test: ${testName}`);

    const labRequest = {
      id: Date.now(),
      patient_id,
      patient_name,
      requested_by: midwife_name,
      requested_by_id: midwife_id,
      test_type: testType,
      test_name: testName,
      priority: priority || 'routine',
      clinical_notes: notes,
      status: 'pending',
      requested_at: new Date(),
      hospital_id,
      ward
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_lab`).emit('new_lab_request', {
        patient_id,
        patient_name,
        test_name: testName,
        priority: priority,
        requested_by: midwife_name,
        requested_at: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Lab request sent successfully',
      request: labRequest
    });

  } catch (error) {
    console.error('Error requesting lab test:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get lab results for a patient
// @route   GET /api/midwife/lab-results/:patientId
// @access  Private (Midwife)
export const getLabResults = async (req, res) => {
  try {
    const { patientId } = req.params;

    console.log(`🔬 Fetching lab results for patient: ${patientId}`);

    res.json({
      success: true,
      results: []
    });

  } catch (error) {
    console.error('Error fetching lab results:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== DISCHARGE ====================

// @desc    Get discharged patients for ANC ward
// @route   GET /api/midwife/discharged-patients
// @access  Private (Midwife)
export const getDischargedPatients = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    console.log(`📋 Fetching discharged patients for hospital: ${hospital_id}, ward: ${ward}`);

    const whereClause = {
      hospital_id: hospital_id,
      ward: ward || 'ANC',
      status: 'discharged'
    };

    const patients = await Patient.findAll({
      where: whereClause,
      order: [['updatedAt', 'DESC']],
      limit: 100
    });

    res.json({
      success: true,
      patients: patients || []
    });

  } catch (error) {
    console.error('Error fetching discharged patients:', error);
    res.json({
      success: true,
      patients: []
    });
  }
};

// @desc    Discharge patient from ANC ward
// @route   POST /api/midwife/discharge-patient
// @access  Private (Midwife)
export const dischargePatient = async (req, res) => {
  try {
    const { 
      patient_id, 
      midwife_id, 
      midwife_name, 
      hospital_id, 
      ward,
      diagnosis,
      prescriptions,
      lab_results,
      discharge_location,
      signature,
      discharge_notes
    } = req.body;

    console.log(`🏠 Discharging patient: ${patient_id} to ${discharge_location}`);

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const updateData = {
      status: 'discharged',
      updatedAt: new Date()
    };

    if (discharge_location !== undefined) updateData.discharge_location = discharge_location;
    if (midwife_name !== undefined) updateData.discharged_by = midwife_name;
    if (midwife_id !== undefined) updateData.discharged_by_id = midwife_id;
    if (discharge_notes || diagnosis?.notes) updateData.discharge_notes = discharge_notes || diagnosis?.notes || '';

    await patient.update(updateData);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_ward_${ward || 'ANC'}`).emit('patient_discharged', {
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        discharge_location,
        discharged_by: midwife_name,
        discharged_at: new Date()
      });
    }

    res.json({
      success: true,
      message: `Patient discharged to ${discharge_location} successfully`,
      patient: {
        id: patient.id,
        status: 'discharged',
        discharge_location: discharge_location,
        discharged_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error discharging patient:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== ADMISSION & BEDS ====================

// @desc    Get available beds for admission
// @route   GET /api/midwife/available-beds
// @access  Private (Midwife)
export const getAvailableBeds = async (req, res) => {
  try {
    const { ward, hospital_id } = req.query;

    console.log(`🛏️ Fetching available beds for ward: ${ward}, hospital: ${hospital_id}`);

    const beds = [
      { id: 1, number: '101', type: 'general', status: 'available' },
      { id: 2, number: '102', type: 'general', status: 'available' },
      { id: 3, number: '103', type: 'private', status: 'available' },
      { id: 4, number: '104', type: 'general', status: 'available' },
      { id: 5, number: '105', type: 'private', status: 'available' },
      { id: 6, number: '106', type: 'general', status: 'available' }
    ];

    res.json({
      success: true,
      beds: beds
    });

  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Admit patient to ward
// @route   POST /api/midwife/admit-patient
// @access  Private (Midwife)
export const admitPatient = async (req, res) => {
  try {
    const { 
      patient_id, 
      midwife_id, 
      midwife_name, 
      hospital_id, 
      ward,
      bed_id,
      diagnosis,
      prescriptions,
      lab_results,
      signature,
      admission_notes
    } = req.body;

    console.log(`🏥 Admitting patient: ${patient_id} to bed: ${bed_id}`);

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    await patient.update({
      status: 'admitted',
      bed_id: bed_id,
      admitted_at: new Date(),
      admitted_by: midwife_name,
      admitted_by_id: midwife_id,
      admission_notes: admission_notes || diagnosis?.notes || '',
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_ward_${ward}`).emit('patient_admitted', {
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        bed_id,
        admitted_by: midwife_name,
        admitted_at: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Patient admitted successfully',
      patient: {
        id: patient.id,
        status: 'admitted',
        bed_id: bed_id,
        admitted_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error admitting patient:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== REFERRAL ====================

// @desc    Refer patient to another ward or hospital
// @route   POST /api/midwife/refer-patient
// @access  Private (Midwife)
export const referPatient = async (req, res) => {
  try {
    const { 
      patient_id, 
      midwife_id, 
      midwife_name, 
      hospital_id, 
      ward,
      referral_type,
      destination,
      bed_id,
      external_data,
      diagnosis,
      prescriptions,
      lab_results,
      signature,
      referral_notes
    } = req.body;

    console.log(`🔄 Referring patient: ${patient_id} to ${destination} (${referral_type})`);

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const referralData = {
      referred_from: ward,
      referred_from_id: midwife_id,
      referred_from_name: midwife_name,
      referral_type: referral_type,
      destination: destination,
      bed_id: bed_id || null,
      external_data: external_data || null,
      referral_diagnosis: diagnosis,
      referral_prescriptions: prescriptions,
      referral_lab_results: lab_results,
      referral_signature: signature,
      referral_notes: referral_notes || diagnosis?.notes || '',
      referred_at: new Date()
    };

    await patient.update({
      status: 'referred',
      referral_data: referralData,
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_ward_${ward}`).emit('patient_referred_out', {
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        destination,
        referred_by: midwife_name,
        referred_at: new Date()
      });

      if (referral_type === 'internal') {
        io.to(`hospital_${hospital_id}_ward_${destination}`).emit('patient_referred_in', {
          patient_id,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          referred_from: ward,
          referred_by: midwife_name,
          bed_id: bed_id,
          referred_at: new Date()
        });
      }
    }

    res.json({
      success: true,
      message: `Patient referred to ${destination} successfully`,
      bed_number: bed_id,
      patient: {
        id: patient.id,
        status: 'referred',
        referral_data: referralData
      }
    });

  } catch (error) {
    console.error('Error referring patient:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== PROFILE ====================

// @desc    Get midwife profile
// @route   GET /api/midwife/profile
// @access  Private (Midwife)
export const getProfile = async (req, res) => {
  try {
    const staff = req.user;

    res.json({
      success: true,
      staff: {
        id: staff.id,
        first_name: staff.first_name,
        middle_name: staff.middle_name,
        last_name: staff.last_name,
        gender: staff.gender,
        age: staff.age,
        phone: staff.phone,
        email: staff.email,
        department: staff.department
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Update midwife profile
// @route   PUT /api/midwife/profile
// @access  Private (Midwife)
export const updateProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone } = req.body;
    const staff = req.user;

    await staff.update({
      first_name,
      middle_name,
      last_name,
      gender,
      age,
      phone,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      staff: {
        id: staff.id,
        first_name: staff.first_name,
        middle_name: staff.middle_name,
        last_name: staff.last_name,
        gender: staff.gender,
        age: staff.age,
        phone: staff.phone,
        email: staff.email,
        department: staff.department
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Change password
// @route   PUT /api/midwife/change-password
// @access  Private (Midwife)
export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const staff = req.user;

    const isMatch = await staff.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    staff.password = new_password;
    await staff.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== STAFF MANAGEMENT (NEW) ====================

// @desc    Get all doctors for midwife
// @route   GET /api/midwife/doctors
// @access  Private (Midwife)
export const getDoctors = async (req, res) => {
  try {
    console.log('👨‍⚕️ Fetching doctors for hospital:', req.user.hospital_id);

    const doctors = await HospitalStaff.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        role: 'doctor'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'specialization', 'ward']
    });
    
    const formattedDoctors = doctors.map(doc => ({
      id: doc.id,
      full_name: `${doc.first_name || ''} ${doc.middle_name || ''} ${doc.last_name || ''}`.trim().replace(/\s+/g, ' '),
      specialization: doc.specialization || 'General',
      ward: doc.ward || 'General'
    }));
    
    console.log(`✅ Found ${formattedDoctors.length} doctors`);
    
    res.json({ 
      success: true, 
      doctors: formattedDoctors 
    });
  } catch (error) {
    console.error("Get doctors error:", error);
    res.json({ success: true, doctors: [] });
  }
};

// @desc    Get pharmacy staff for midwife
// @route   GET /api/midwife/pharmacy-staff
// @access  Private (Midwife)
export const getPharmacyStaff = async (req, res) => {
  try {
    console.log('💊 Fetching pharmacy staff for hospital:', req.user.hospital_id);

    const pharmacyStaff = await HospitalStaff.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        role: 'pharmacist'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name']
    });
    
    const formattedStaff = pharmacyStaff.map(staff => ({
      id: staff.id,
      full_name: `${staff.first_name || ''} ${staff.middle_name || ''} ${staff.last_name || ''}`.trim().replace(/\s+/g, ' ')
    }));
    
    console.log(`✅ Found ${formattedStaff.length} pharmacy staff`);
    
    res.json({ 
      success: true, 
      staff: formattedStaff 
    });
  } catch (error) {
    console.error("Get pharmacy staff error:", error);
    res.json({ success: true, staff: [] });
  }
};

// @desc    Get lab staff for midwife
// @route   GET /api/midwife/lab-staff
// @access  Private (Midwife)
export const getLabStaff = async (req, res) => {
  try {
    console.log('🔬 Fetching lab staff for hospital:', req.user.hospital_id);

    const labStaff = await HospitalStaff.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        role: 'lab_technician'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name']
    });
    
    const formattedStaff = labStaff.map(staff => ({
      id: staff.id,
      full_name: `${staff.first_name || ''} ${staff.middle_name || ''} ${staff.last_name || ''}`.trim().replace(/\s+/g, ' ')
    }));
    
    console.log(`✅ Found ${formattedStaff.length} lab staff`);
    
    res.json({ 
      success: true, 
      staff: formattedStaff 
    });
  } catch (error) {
    console.error("Get lab staff error:", error);
    res.json({ success: true, staff: [] });
  }
};

// ==================== REPORTS ====================

// Helper function to generate unique report number
const generateUniqueReportNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastReport = await Report.findOne({ 
    order: [['id', 'DESC']], 
    attributes: ['report_number'] 
  });
  
  let nextNumber = 1;
  if (lastReport && lastReport.report_number) {
    const match = lastReport.report_number.match(/RPT-\d+-\d+-(\d+)/);
    if (match) nextNumber = parseInt(match[1]) + 1;
    else nextNumber = (await Report.count()) + 1;
  }
  
  return `RPT-${year}-${month}-${String(nextNumber).padStart(4, '0')}`;
};

// @desc    Get reports inbox for midwife
// @route   GET /api/midwife/reports/inbox
// @access  Private (Midwife)
export const getReportsInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
        { sender_full_name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    
    const reports = await Report.findAll({
      where: whereClause,
      order: [['sent_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const unreadCount = await Report.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        is_opened: false
      }
    });
    
    res.json({
      success: true,
      reports,
      unreadCount,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error("Get midwife reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reports outbox for midwife
// @route   GET /api/midwife/reports/outbox
// @access  Private (Midwife)
export const getReportsOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      sender_id: req.user.id,
      sender_type: 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
        { recipient_full_name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const totalCount = await Report.count({ where: whereClause });
    
    const reports = await Report.findAll({
      where: whereClause,
      order: [['sent_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      reports,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error("Get midwife reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send report from midwife
// @route   POST /api/midwife/reports/send
// @access  Private (Midwife)
export const sendReport = async (req, res) => {
  try {
    const { title, subject, body, priority, recipient_type, recipient_id } = req.body;

    const sender = await HospitalStaff.findByPk(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    let recipient = null;
    let recipientFullName = '';
    
    if (recipient_type === 'hospital_admin') {
      recipient = await HospitalAdmin.findByPk(recipient_id);
      if (recipient) {
        recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      }
    }

    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    const report_number = await generateUniqueReportNumber();

    const report = await Report.create({
      report_number,
      title,
      subject: subject || title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Midwife - ANC Department`,
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipient.hospital_name,
      recipient_hospital_id: recipient.id,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      const adminRoom = `hospital_${recipient.id}_admin`;
      io.to(adminRoom).emit('new_report_from_midwife', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_department: 'Midwife - ANC',
        sent_at: report.sent_at
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send midwife report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark report as read
// @route   PUT /api/midwife/reports/:reportId/read
// @access  Private (Midwife)
export const markReportAsRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.reportId,
        recipient_id: req.user.id,
        recipient_type: 'staff'
      }
    });

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    await report.update({
      is_opened: true,
      opened_at: new Date(),
      opened_count: (report.opened_count || 0) + 1
    });

    res.json({ success: true, message: "Report marked as read" });
  } catch (error) {
    console.error("Mark report read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reply to report
// @route   POST /api/midwife/reports/:reportId/reply
// @access  Private (Midwife)
export const replyToReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log('📨 Full request body:', req.body);
    
    // Get body from either JSON or FormData
    let body = '';
    
    if (req.body && typeof req.body === 'object') {
      body = req.body.body || req.body.message || '';
    }
    
    if (!body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reply message is required' 
      });
    }

    const parentReport = await Report.findByPk(reportId);

    if (!parentReport) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }

    // Check if user is authorized to reply
    const isParticipant = (
      (parentReport.sender_id === req.user.id && parentReport.sender_type === 'staff') ||
      (parentReport.recipient_id === req.user.id && parentReport.recipient_type === 'staff')
    );

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to reply to this report' 
      });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ 
        success: false, 
        message: "Sender not found" 
      });
    }

    const recipientId = parentReport.sender_id === req.user.id ? parentReport.recipient_id : parentReport.sender_id;
    const recipientType = parentReport.sender_id === req.user.id ? parentReport.recipient_type : parentReport.sender_type;

    let recipientFirstName = '';
    let recipientMiddleName = '';
    let recipientLastName = '';
    let recipientFullName = '';
    let recipientHospitalId = null;
    let recipientHospitalName = '';

    if (recipientType === 'hospital') {
      const hospitalAdmin = await HospitalAdmin.findByPk(recipientId);
      if (hospitalAdmin) {
        recipientFirstName = hospitalAdmin.first_name || '';
        recipientMiddleName = hospitalAdmin.middle_name || '';
        recipientLastName = hospitalAdmin.last_name || '';
        recipientFullName = `${recipientFirstName} ${recipientMiddleName ? recipientMiddleName + ' ' : ''}${recipientLastName}`.trim();
        recipientHospitalId = hospitalAdmin.id;
        recipientHospitalName = hospitalAdmin.hospital_name || '';
      }
    }

    const report_number = await generateUniqueReportNumber();

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject,
      body,
      priority: parentReport.priority,
      status: 'sent',
      attachments: [],
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Midwife - ANC Department`,
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      recipient_id: recipientId,
      recipient_type: recipientType,
      recipient_first_name: recipientFirstName,
      recipient_middle_name: recipientMiddleName,
      recipient_last_name: recipientLastName,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipientHospitalName,
      recipient_hospital_id: recipientHospitalId,
      parent_report_id: parentReport.id,
      thread_id: parentReport.thread_id || parentReport.id,
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    await parentReport.update({ 
      status: 'replied', 
      last_activity_at: new Date(),
      reply_count: (parentReport.reply_count || 0) + 1
    });

    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      
      if (recipientType === 'hospital') {
        recipientRoom = `hospital_${recipientHospitalId}_admin`;
      }
      
      io.to(recipientRoom).emit('report_reply_from_midwife', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_department: 'Midwife - ANC',
        sent_at: reply.sent_at,
        body_preview: body.substring(0, 100),
        body: body,
        is_reply: true
      });
    }

    res.json({ 
      success: true, 
      reply, 
      message: "Reply sent successfully" 
    });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get hospital admins for midwife
// @route   GET /api/midwife/hospital-admins
// @access  Private (Midwife)
export const getHospitalAdmins = async (req, res) => {
  try {
    // The hospital admin's id is the hospital ID
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { id: req.user.hospital_id },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    const formattedAdmins = hospitalAdmins.map(admin => ({
      id: admin.id,
      full_name: `${admin.first_name || ''} ${admin.middle_name || ''} ${admin.last_name || ''}`.trim().replace(/\s+/g, ' '),
      email: admin.email,
      hospital_name: admin.hospital_name,
      hospital_id: admin.id
    }));
    
    res.json({ success: true, admins: formattedAdmins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.json({ success: true, admins: [] });
  }
};