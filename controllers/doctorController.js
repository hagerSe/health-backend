import Patient from '../models/Patient.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import KebeleAdmin from '../models/KebeleAdmin.js';
import Report from '../models/Report.js';
import LabRequest from '../models/LabRequest.js';
import LabResult from '../models/LabResult.js';
import RadiologyRequest from '../models/RadiologyRequest.js';
import RadiologyReport from '../models/RadiologyReport.js';
import Bed from '../models/Bed.js';
import Admission from '../models/Admission.js';
import Referral from '../models/Referral.js';
import Prescription from '../models/Prescription.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

// Valid wards from Bed model ENUM
const VALID_WARDS = ['OPD', 'EME', 'ANC'];

// ==================== PATIENT QUEUE ====================

// @desc    Get patient queue for specific ward
// @route   GET /api/doctor/queue
// @access  Private
// @desc    Get patient queue for specific ward
// @route   GET /api/doctor/queue
// @access  Private
export const getQueue = async (req, res) => {
  try {
    const { ward, hospital_id, doctor_id } = req.query;
    
    console.log(`Fetching queue for ward: ${ward}, hospital: ${hospital_id}`);

    // ✅ Include ALL statuses that should appear in doctor's queue
    // Patients from triage come with status: 'in_opd', 'in_emergency', or 'in_anc'
    const whereClause = {
      hospital_id: hospital_id,
      ward: ward,
      status: {
        [Op.in]: [
          'triaged',           // Patients waiting after triage
          'registered',        // Newly registered patients
          'in_opd',           // Patients sent to OPD from triage
          'in_emergency',     // Patients sent to EME from triage
          'in_anc',           // Patients sent to ANC from triage
          'with_doctor'       // Patients currently with doctor
        ]
      }
    };

    // If doctor_id is provided, show patients assigned to this doctor OR unassigned
    if (doctor_id) {
      whereClause[Op.and] = [
        {
          [Op.or]: [
            { doctor_id: doctor_id },
            { doctor_id: null }
          ]
        }
      ];
    }

    const queue = await Patient.findAll({
      where: whereClause,
      attributes: [
        'id', 'card_number', 'first_name', 'middle_name', 'last_name',
        'age', 'gender', 'phone', 'status', 'ward', 'vitals', 'triage_info',
        'diagnosis', 'doctor_id', 'doctor_name',
        'registered_at', 'triaged_at', 'consultation_started_at', 'createdAt', 'updatedAt'
      ],
      order: [
        // Order by priority: critical > urgent > high > routine
        [sequelize.literal(`CASE 
          WHEN triage_info->>'priority' = 'critical' THEN 1
          WHEN triage_info->>'priority' = 'urgent' THEN 2
          WHEN triage_info->>'priority' = 'high' THEN 3
          WHEN triage_info->>'priority' = 'routine' THEN 4
          ELSE 5
        END`), 'ASC'],
        ['triaged_at', 'ASC'],
        ['registered_at', 'ASC']
      ]
    });

    console.log(`Found ${queue.length} patients in queue`);

    // Check for new lab/radiology results
    const enhancedQueue = await Promise.all(queue.map(async (patient) => {
      const patientData = patient.toJSON();
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const newLabResults = await LabResult.count({
        where: {
          patient_id: patient.id,
          hospital_id: hospital_id,
          reported_at: {
            [Op.gte]: fiveMinutesAgo
          }
        }
      });
      
      const newRadiologyResults = await RadiologyReport.count({
        where: {
          patient_id: patient.id,
          hospital_id: hospital_id,
          reported_at: {
            [Op.gte]: fiveMinutesAgo
          }
        }
      });

      return {
        ...patientData,
        has_new_results: newLabResults > 0 || newRadiologyResults > 0
      };
    }));

    res.json({
      success: true,
      queue: enhancedQueue
    });

  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// ==================== DOCTOR STATS ====================

// @desc    Get doctor stats
// @route   GET /api/doctor/stats
// @access  Private
// @desc    Get doctor stats
// @route   GET /api/doctor/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const { ward, hospital_id, doctor_id } = req.query;

    console.log(`📊 Fetching stats for doctor: ${doctor_id}, hospital: ${hospital_id}, ward: ${ward}`);

    // ✅ Include patients in OPD/EME/ANC wards
    const waiting = await Patient.count({
      where: {
        hospital_id,
        ward,
        status: {
          [Op.in]: ['triaged', 'registered', 'in_opd', 'in_emergency', 'in_anc']
        },
        doctor_id: null
      }
    }).catch(() => 0);

    const inConsultation = await Patient.count({
      where: {
        hospital_id,
        doctor_id,
        status: 'with_doctor'
      }
    }).catch(() => 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completed = await Patient.count({
      where: {
        hospital_id,
        doctor_id,
        status: {
          [Op.in]: ['discharged', 'completed', 'admitted', 'referred']
        },
        updatedAt: {
          [Op.gte]: today
        }
      }
    }).catch(() => 0);

    const pendingLabs = await LabRequest.count({
      where: {
        hospital_id,
        doctor_id,
        status: {
          [Op.in]: ['pending', 'processing']
        }
      }
    }).catch(() => 0);

    const pendingRadiology = await RadiologyRequest.count({
      where: {
        hospital_id,
        doctor_id,
        status: 'pending'
      }
    }).catch(() => 0);

    const admitted = await Admission.count({
      where: {
        hospital_id,
        doctor_id,
        status: 'active'
      }
    }).catch(() => 0);
    
    res.json({
      success: true,
      stats: {
        waiting: waiting || 0,
        inConsultation: inConsultation || 0,
        completed: completed || 0,
        pendingLabs: pendingLabs || 0,
        pendingRadiology: pendingRadiology || 0,
        admitted: admitted || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.json({
      success: true,
      stats: {
        waiting: 0,
        inConsultation: 0,
        completed: 0,
        pendingLabs: 0,
        pendingRadiology: 0,
        admitted: 0
      }
    });
  }
};

// ==================== ASSIGN PATIENT ====================

// @desc    Assign patient to doctor
// @route   POST /api/doctor/assign-patient
// @access  Private
// @desc    Assign patient to doctor
// @route   POST /api/doctor/assign-patient
// @access  Private
export const assignPatient = async (req, res) => {
  try {
    const { patient_id, doctor_id, doctor_name, ward, hospital_id } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    // ✅ Update status to 'with_doctor' regardless of previous status
    await patient.update({
      doctor_id,
      doctor_name,
      status: 'with_doctor',
      consultation_started_at: new Date(),
      updatedAt: new Date()
    });

    const updatedPatient = await Patient.findByPk(patient_id, {
      attributes: [
        'id', 'card_number', 'first_name', 'middle_name', 'last_name',
        'age', 'gender', 'phone', 'status', 'ward', 'vitals', 'triage_info',
        'diagnosis', 'doctor_id', 'doctor_name', 'prescriptions_history',
        'registered_at', 'triaged_at', 'consultation_started_at', 'createdAt', 'updatedAt'
      ]
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_ward_${ward}`).emit('patient_taken', {
        patient_id,
        doctor_id,
        doctor_name,
        ward
      });
      
      io.to(`hospital_${hospital_id}_doctor_${doctor_id}`).emit('patient_assigned', {
        patient: updatedPatient
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
// ==================== SAVE DIAGNOSIS ====================

// @desc    Save diagnosis
// @route   POST /api/doctor/save-diagnosis
// @access  Private
export const saveDiagnosis = async (req, res) => {
  try {
    const { patient_id, diagnosis, doctor_id, hospital_id } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    await patient.update({
      diagnosis,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Diagnosis saved successfully'
    });

  } catch (error) {
    console.error('Error saving diagnosis:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== SAVE PRESCRIPTIONS ====================

// @desc    Save prescriptions
// @route   POST /api/doctor/save-prescriptions
// @access  Private
export const savePrescriptions = async (req, res) => {
  try {
    const { 
      patient_id, patient_name, prescriptions, 
      doctor_id, doctor_name, ward, hospital_id,
      priority, notes 
    } = req.body;

    console.log('📋 Saving prescriptions:', {
      patient_id, patient_name,
      doctor_id, doctor_name,
      ward, hospital_id,
      items_count: prescriptions?.length
    });

    if (!prescriptions || prescriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No prescriptions to save'
      });
    }

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    let currentHistory = patient.prescriptions_history || [];
    
    const year = new Date().getFullYear();
    const prescriptionNumber = `RX-${year}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const formattedPrescriptions = prescriptions.map((p, index) => ({
      id: `${Date.now()}-${index}`,
      prescription_number: prescriptionNumber,
      name: p.name,
      dosage: p.dosage,
      quantity: p.quantity || 1,
      unit: p.unit || 'tablet',
      frequency: p.frequency || 'as directed',
      duration: p.duration || 'as prescribed',
      route: p.route || 'oral',
      notes: p.notes || '',
      status: 'pending',
      priority: priority || 'routine',
      prescribed_at: new Date().toISOString(),
      prescribed_by: doctor_name,
      doctor_id: doctor_id,
      ward: ward,
      hospital_id: hospital_id
    }));
    
    currentHistory = [...currentHistory, ...formattedPrescriptions];
    
    await patient.update({
      prescriptions_history: currentHistory,
      updatedAt: new Date()
    });
    
    console.log(`✅ Updated patient ${patient_id} prescriptions_history`);

    const prescriptionRecord = await Prescription.create({
      prescription_number: prescriptionNumber,
      patient_id: patient_id,
      patient_name: patient_name || `${patient.first_name} ${patient.last_name}`,
      doctor_id: doctor_id,
      doctor_name: doctor_name,
      ward: ward,
      hospital_id: hospital_id,
      priority: priority || 'routine',
      status: 'pending',
      items: prescriptions,
      notes: notes || '',
      prescribed_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_pharmacy`).emit('new_prescriptions', {
        id: prescriptionRecord.id,
        prescription_id: prescriptionRecord.id,
        prescription_number: prescriptionNumber,
        patient_id: patient_id,
        patient_name: patient_name || `${patient.first_name} ${patient.last_name}`,
        doctor_id: doctor_id,
        doctor_name: doctor_name,
        ward: ward,
        hospital_id: hospital_id,
        priority: priority || 'routine',
        items_count: prescriptions.length,
        items: prescriptions,
        notes: notes || '',
        prescribed_at: new Date().toISOString(),
        status: 'pending'
      });
    }

    res.json({
      success: true,
      message: `${prescriptions.length} prescription(s) saved successfully`,
      prescription_number: prescriptionNumber,
      prescription_id: prescriptionRecord.id,
      prescriptions: formattedPrescriptions
    });

  } catch (error) {
    console.error('❌ Error saving prescriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== LAB RESULTS ====================

// @desc    Get lab results for patient
// @route   GET /api/doctor/lab-results/:patientId
// @access  Private
export const getLabResults = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctor_id, hospital_id } = req.query;
    
    console.log(`📋 Fetching lab results for patient: ${patientId}`);

    if (!hospital_id) {
      return res.json({
        success: true,
        patient_id: patientId,
        summary: { total_requests: 0, completed_count: 0, pending_count: 0 },
        completed: [],
        pending: []
      });
    }

    const whereClause = { 
      patient_id: patientId,
      hospital_id: hospital_id
    };
    
    if (doctor_id) {
      whereClause.doctor_id = doctor_id;
    }

    const labRequests = await LabRequest.findAll({
      where: whereClause,
      include: [{
        model: LabResult,
        as: 'result',
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    const completed = labRequests.filter(req => req.status === 'completed' && req.result);
    const pending = labRequests.filter(req => req.status !== 'completed' && req.status !== 'cancelled');

    res.json({
      success: true,
      patient_id: patientId,
      summary: {
        total_requests: labRequests.length,
        completed_count: completed.length,
        pending_count: pending.length
      },
      completed: completed.map(req => ({
        id: req.result.id,
        request_id: req.id,
        test_name: req.test_name,
        test_type: req.test_type,
        priority: req.priority,
        requested_at: req.requested_at,
        completed_at: req.completed_at,
        result: req.result.result,
        critical: req.result.critical,
        normal_range: req.result.normal_range,
        reported_at: req.result.reported_at,
        reported_by: req.result.reported_by,
        recommendations: req.result.recommendations
      })),
      pending: pending.map(req => ({
        request_id: req.id,
        test_name: req.test_name,
        test_type: req.test_type,
        priority: req.priority,
        status: req.status,
        requested_at: req.requested_at,
        notes: req.notes
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching lab results:', error);
    res.json({
      success: true,
      patient_id: req.params.patientId,
      summary: { total_requests: 0, completed_count: 0, pending_count: 0 },
      completed: [],
      pending: []
    });
  }
};

// ==================== RADIOLOGY RESULTS ====================

// @desc    Get radiology results for patient
// @route   GET /api/doctor/radiology-results/:patientId
// @access  Private
export const getRadiologyResults = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctor_id, hospital_id } = req.query;
    
    console.log(`📷 Fetching radiology results for patient: ${patientId}`);
    
    let results = [];
    
    try {
      const radiologyReports = await RadiologyReport.findAll({
        where: { patient_id: patientId },
        order: [['reported_at', 'DESC']]
      });
      
      results = radiologyReports.map(report => {
        const jsonReport = report.toJSON();
        let images = jsonReport.images || [];
        if (typeof images === 'string') {
          try {
            images = JSON.parse(images);
          } catch (e) {
            images = [];
          }
        }
        
        return {
          id: jsonReport.id,
          request_id: jsonReport.request_id,
          patient_id: jsonReport.patient_id,
          patient_name: jsonReport.patient_name,
          exam_type: jsonReport.exam_type,
          body_part: jsonReport.body_part,
          findings: jsonReport.findings,
          impression: jsonReport.impression,
          report: jsonReport.report,
          status: jsonReport.status,
          critical: jsonReport.critical || false,
          reported_by: jsonReport.reported_by,
          reported_at: jsonReport.reported_at,
          images: images
        };
      });
      
      console.log(`✅ Found ${results.length} radiology results`);
    } catch (error) {
      console.error('Error fetching radiology results:', error);
    }

    res.json({
      success: true,
      results: results || []
    });

  } catch (error) {
    console.error('❌ Error fetching radiology results:', error);
    res.json({
      success: true,
      results: []
    });
  }
};

// ==================== AVAILABLE BEDS ====================

// @desc    Get available beds
// @route   GET /api/doctor/available-beds
// @access  Private
export const getAvailableBeds = async (req, res) => {
  try {
    const { ward, hospital_id } = req.query;
    
    if (!ward || !hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'Ward and hospital_id are required'
      });
    }

    console.log(`🔍 Fetching available beds for ward: ${ward}, hospital: ${hospital_id}`);

    const beds = await Bed.findAll({
      where: {
        hospital_id: parseInt(hospital_id),
        ward: ward,
        status: 'available'
      },
      order: [['number', 'ASC']]
    });

    res.json({
      success: true,
      beds: beds.map(bed => ({
        id: bed.id,
        number: bed.number,
        type: bed.type,
        status: bed.status,
        ward: bed.ward,
        notes: bed.notes
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching available beds:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available beds',
      error: error.message
    });
  }
};

// ==================== ADMIT PATIENT ====================

// @desc    Admit patient to ward
// @route   POST /api/doctor/admit-patient
// @access  Private
export const admitPatient = async (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      doctor_name,
      hospital_id,
      ward,
      bed_id,
      diagnosis,
      prescriptions,
      admission_notes,
      signature
    } = req.body;

    if (!patient_id || !bed_id || !ward || !hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const bed = await Bed.findByPk(bed_id);
    
    if (!bed) {
      return res.status(404).json({ success: false, message: 'Bed not found' });
    }

    if (bed.status !== 'available') {
      return res.status(400).json({ 
        success: false, 
        message: `Bed ${bed.number} is not available` 
      });
    }

    const transaction = await sequelize.transaction();

    try {
      await bed.update({
        status: 'occupied',
        current_patient_id: patient_id,
        current_patient_name: `Patient ${patient_id}`,
        last_occupied_at: new Date()
      }, { transaction });

      const patient = await Patient.findByPk(patient_id);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : `Patient ${patient_id}`;

      await Admission.create({
        patient_id,
        patient_name: patientName,
        doctor_id,
        doctor_name,
        hospital_id,
        ward,
        bed_id,
        bed_number: bed.number,
        diagnosis: diagnosis?.primary || 'Not specified',
        admission_notes: admission_notes || diagnosis?.notes || '',
        admitted_by: doctor_name,
        admitted_at: new Date(),
        status: 'active',
        signature
      }, { transaction });

      await Patient.update({
        status: 'admitted',
        consultation_ended_at: new Date()
      }, {
        where: { id: patient_id },
        transaction
      });

      await transaction.commit();

      const io = req.app.get('io');
      if (io) {
        io.to(`hospital_${hospital_id}_doctor_${doctor_id}`).emit('patient_admitted', {
          patient_id,
          patient_name: patientName,
          bed_id: bed.id,
          bed_number: bed.number,
          ward
        });
      }

      res.json({
        success: true,
        message: 'Patient admitted successfully'
      });

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ Error admitting patient:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REQUEST LAB ====================

// @desc    Request lab test
// @route   POST /api/doctor/request-lab
// @access  Private
export const requestLab = async (req, res) => {
  try {
    const { 
      patient_id, patient_name, doctor_id, doctor_name, 
      ward, hospital_id, test_type, testName, priority, notes 
    } = req.body;

    if (!patient_id || !doctor_id || !hospital_id || !testName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const request_number = `LAB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const labRequest = await LabRequest.create({
      patient_id,
      patient_name,
      doctor_id,
      doctor_name,
      ward,
      hospital_id,
      request_number,
      test_type: test_type || 'blood',
      test_name: testName,
      priority: priority || 'routine',
      notes,
      status: 'pending',
      requested_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_lab`).emit('new_lab_request', {
        request_id: labRequest.id,
        request_number: labRequest.request_number,
        patient_id,
        patient_name,
        test_name: testName,
        test_type: test_type || 'blood',
        priority: priority || 'routine',
        doctor_name,
        ward,
        hospital_id
      });
    }

    res.json({
      success: true,
      message: 'Lab request sent successfully',
      request: labRequest
    });

  } catch (error) {
    console.error('❌ Error requesting lab:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REQUEST RADIOLOGY ====================

// @desc    Request radiology
// @route   POST /api/doctor/request-radiology
// @access  Private
export const requestRadiology = async (req, res) => {
  try {
    const { 
      patient_id, patient_name, doctor_id, doctor_name,
      ward, hospital_id, examType, bodyPart, priority, notes 
    } = req.body;

    if (!patient_id || !doctor_id || !hospital_id || !examType || !bodyPart) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const request_number = `RAD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const radiologyRequest = await RadiologyRequest.create({
      patient_id,
      patient_name,
      doctor_id,
      doctor_name,
      ward,
      hospital_id,
      request_number,
      exam_type: examType,
      body_part: bodyPart,
      priority: priority || 'routine',
      clinical_notes: notes,
      status: 'pending',
      requested_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_radiology`).emit('new_radiology_request', {
        request_id: radiologyRequest.id,
        request_number: radiologyRequest.request_number,
        patient_id,
        patient_name,
        doctor_name,
        exam_type: examType,
        body_part: bodyPart,
        priority: priority || 'routine',
        ward,
        hospital_id
      });
    }

    res.json({
      success: true,
      message: 'Radiology request sent successfully',
      request: radiologyRequest
    });

  } catch (error) {
    console.error('Error requesting radiology:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DISCHARGE PATIENT ====================

// @desc    Discharge patient
// @route   POST /api/doctor/discharge-patient
// @access  Private
export const dischargePatient = async (req, res) => {
  try {
    const { 
      patient_id, doctor_id, doctor_name, hospital_id, ward,
      diagnosis, prescriptions, lab_requests, lab_results,
      radiology_requests, radiology_results, discharge_type,
      signature, discharge_notes, discharge_location, pharmacy_status
    } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const activeAdmission = await Admission.findOne({
      where: {
        patient_id,
        status: 'active'
      }
    });

    if (activeAdmission) {
      await activeAdmission.update({
        status: 'discharged',
        discharged_at: new Date(),
        discharged_by: doctor_name,
        discharge_notes: discharge_notes || diagnosis?.notes || ''
      });
    }

    if (activeAdmission && activeAdmission.bed_id) {
      await Bed.update(
        {
          status: 'available',
          current_patient_id: null,
          current_patient_name: null
        },
        {
          where: { id: activeAdmission.bed_id }
        }
      );
    }

    const dischargeSummary = {
      diagnosis,
      prescriptions,
      lab_requests,
      lab_results,
      radiology_requests,
      radiology_results,
      discharge_type: discharge_type || 'discharge',
      discharge_location: discharge_location || 'Home',
      discharged_by: doctor_name,
      discharged_at: new Date(),
      signature,
      notes: discharge_notes || diagnosis?.notes || '',
      pharmacy_status: pharmacy_status || { all_dispensed: true, pending_count: 0 }
    };

    await patient.update({
      status: 'discharged',
      discharge_summary: dischargeSummary,
      consultation_ended_at: new Date(),
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_doctor_${doctor_id}`).emit('patient_removed', {
        patient_id,
        reason: 'discharged'
      });
      
      io.to(`hospital_${hospital_id}_ward_${ward}`).emit('patient_removed', {
        patient_id,
        reason: 'discharged'
      });
    }

    res.json({
      success: true,
      message: `Patient discharged to ${discharge_location || 'Home'} successfully`,
      patient: { id: patient.id, status: 'discharged' }
    });

  } catch (error) {
    console.error('Error discharging patient:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REFER PATIENT ====================

// @desc    Refer patient
// @route   POST /api/doctor/refer-patient
// @access  Private
export const referPatient = async (req, res) => {
  try {
    const { 
      patient_id, doctor_id, doctor_name, hospital_id, ward,
      referral_type, destination, bed_id, diagnosis, prescriptions,
      lab_requests, lab_results, radiology_requests, radiology_results,
      signature, referral_notes 
    } = req.body;

    if (referral_type === 'internal' && !VALID_WARDS.includes(destination)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid destination ward. Available wards: ${VALID_WARDS.join(', ')}` 
      });
    }

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    let bedInfo = null;
    
    if (referral_type === 'internal' && bed_id) {
      const bed = await Bed.findByPk(bed_id);
      
      if (!bed) {
        return res.status(404).json({ success: false, message: 'Bed not found' });
      }
      
      if (bed.status !== 'available') {
        return res.status(400).json({ 
          success: false, 
          message: `Bed ${bed.number} is not available` 
        });
      }
      
      if (bed.ward !== destination) {
        return res.status(400).json({ 
          success: false, 
          message: `Bed ${bed.number} is in ${bed.ward} ward, not ${destination} ward` 
        });
      }
      
      bedInfo = bed;
    }

    const referral = await Referral.create({
      patient_id,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      referring_doctor_id: doctor_id,
      referring_doctor_name: doctor_name,
      hospital_id,
      from_ward: ward,
      referral_type,
      destination,
      bed_id: bed_id || null,
      bed_number: bedInfo ? bedInfo.number : null,
      diagnosis: diagnosis?.primary || 'Not specified',
      clinical_summary: diagnosis?.notes || '',
      prescriptions: JSON.stringify(prescriptions || []),
      lab_results: JSON.stringify(lab_results || []),
      radiology_results: JSON.stringify(radiology_results || []),
      status: 'pending',
      referred_at: new Date(),
      signature,
      notes: referral_notes || ''
    });

    if (bedInfo) {
      await bedInfo.update({
        status: 'reserved',
        notes: `Reserved for referral from ${ward} ward`
      });
    }

    await patient.update({
      status: 'referred',
      referral_id: referral.id,
      consultation_ended_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_doctor_${doctor_id}`).emit('patient_removed', {
        patient_id,
        reason: 'referred'
      });
      
      io.to(`hospital_${hospital_id}_ward_${ward}`).emit('patient_removed', {
        patient_id,
        reason: 'referred'
      });
    }

    res.json({
      success: true,
      message: `Patient referred to ${destination}${bedInfo ? `, Bed ${bedInfo.number} reserved` : ''} successfully`,
      referral,
      bed_number: bedInfo ? bedInfo.number : null
    });

  } catch (error) {
    console.error('Error referring patient:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DISCHARGED PATIENTS ====================

// @desc    Get discharged patients
// @route   GET /api/doctor/discharged-patients
// @access  Private
export const getDischargedPatients = async (req, res) => {
  try {
    const { hospital_id, ward } = req.query;

    if (!hospital_id || !ward) {
      return res.status(400).json({
        success: false,
        message: 'hospital_id and ward are required'
      });
    }

    const dischargedPatients = await Patient.findAll({
      where: {
        hospital_id,
        ward,
        status: 'discharged'
      },
      attributes: [
        'id', 'card_number', 'first_name', 'last_name',
        'age', 'gender', 'status', 'discharge_summary',
        'doctor_name', 'updatedAt', 'createdAt'
      ],
      order: [['updatedAt', 'DESC']],
      limit: 50
    });

    const formattedPatients = dischargedPatients.map(patient => {
      const data = patient.toJSON();
      const dischargeSummary = data.discharge_summary || {};
      
      return {
        id: data.id,
        patient_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        card_number: data.card_number,
        diagnosis: dischargeSummary.diagnosis?.primary || 'Not recorded',
        doctor_name: data.doctor_name || 'Unknown',
        discharge_date: data.updatedAt,
        discharge_location: dischargeSummary.discharge_location || 'Home',
        discharge_notes: dischargeSummary.notes || '',
        status: data.status,
        pharmacy_status: dischargeSummary.pharmacy_status || { pending_count: 0, all_dispensed: true },
        prescriptions: dischargeSummary.prescriptions || []
      };
    });

    res.json({
      success: true,
      patients: formattedPatients
    });

  } catch (error) {
    console.error('❌ Error fetching discharged patients:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching discharged patients',
      error: error.message
    });
  }
};

// ==================== HOSPITAL ADMIN FOR DOCTOR (FIXED) ====================

// @desc    Get hospital admin for this doctor's hospital
// @route   GET /api/doctor/hospital-admins
// @access  Private
export const getHospitalAdminsForDoctor = async (req, res) => {
  try {
    console.log('🔍 Fetching hospital admin for doctor...');
    
    // For doctors, hospital_id in req.user is actually the hospital_admin's ID
    const hospitalAdminId = req.user.hospital_id;
    
    if (!hospitalAdminId) {
      console.error('❌ No hospital_admin_id found in req.user');
      return res.status(200).json({
        success: true,
        admins: []
      });
    }
    
    console.log(`🏥 Looking for hospital admin with id: ${hospitalAdminId}`);
    
    const hospitalAdmin = await HospitalAdmin.findByPk(hospitalAdminId, {
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    if (!hospitalAdmin) {
      console.log(`⚠️ No hospital admin found with id: ${hospitalAdminId}`);
      return res.json({
        success: true,
        admins: []
      });
    }
    
    const formattedAdmin = {
      id: hospitalAdmin.id,
      full_name: `${hospitalAdmin.first_name} ${hospitalAdmin.middle_name ? hospitalAdmin.middle_name + ' ' : ''}${hospitalAdmin.last_name}`.trim(),
      email: hospitalAdmin.email,
      hospital_name: hospitalAdmin.hospital_name,
      hospital_id: hospitalAdmin.id
    };
    
    console.log('✅ Found hospital admin:', formattedAdmin.full_name);
    
    res.json({
      success: true,
      admins: [formattedAdmin]
    });
    
  } catch (error) {
    console.error("❌ Get hospital admin error:", error);
    res.status(200).json({ 
      success: true, 
      admins: []
    });
  }
};

// ==================== REPORT MANAGEMENT FOR DOCTORS ====================

// @desc    Get reports inbox for doctor
// @route   GET /api/doctor/reports/inbox
// @access  Private
export const getDoctorReportsInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', priority } = req.query;
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
    
    if (priority && priority !== 'all') {
      whereClause.priority = priority;
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
    console.error("Get doctor reports inbox error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get doctor sent reports (outbox)
// @route   GET /api/doctor/reports/outbox
// @access  Private
export const getDoctorReportsOutbox = async (req, res) => {
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
    console.error("Get doctor reports outbox error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get single report by ID for doctor
// @route   GET /api/doctor/reports/:id
// @access  Private
export const getDoctorReportById = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'staff' },
          { recipient_id: req.user.id, recipient_type: 'staff' }
        ]
      }
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }

    if (report.recipient_id === req.user.id && !report.is_opened) {
      await report.update({
        is_opened: true,
        opened_at: new Date(),
        opened_count: (report.opened_count || 0) + 1
      });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error("Get doctor report by id error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Send report from doctor to hospital admin
// @route   POST /api/doctor/reports/send
// @access  Private
export const sendDoctorReport = async (req, res) => {
  try {
    const {
      title,
      subject,
      body,
      priority,
      recipient_type,
      recipient_id
    } = req.body;

    const sender = await HospitalStaff.findByPk(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ 
        success: false, 
        message: "Sender (doctor) not found" 
      });
    }

    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    
    if (recipient_type === 'hospital_admin') {
      const adminId = recipient_id || sender.hospital_id;
      recipient = await HospitalAdmin.findByPk(adminId);
      
      if (!recipient) {
        return res.status(404).json({ 
          success: false, 
          message: "Hospital admin not found" 
        });
      }
      
      recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      recipientHospitalId = recipient.id; // ✅ Store hospital admin ID
    } else {
      return res.status(400).json({
        success: false,
        message: "Doctors can only send reports to hospital admin"
      });
    }

    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({
      order: [['id', 'DESC']],
      attributes: ['report_number']
    });
    
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      } else {
        const totalCount = await Report.count();
        nextNumber = totalCount + 1;
      }
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

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
      sender_title: `Doctor - ${sender.department || 'Medical'} Department`,
      sender_hospital: recipient.hospital_name,
      sender_hospital_id: sender.hospital_id, // ✅ ADD THIS
      
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipient.hospital_name,
      recipient_hospital_id: recipientHospitalId, // ✅ ADD THIS
      
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      const adminRoom = `hospital_${recipientHospitalId}_admin`;
      console.log(`📡 Emitting new_report_from_doctor to room: ${adminRoom}`);
      io.to(adminRoom).emit('new_report_from_doctor', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_department: sender.department,
        sent_at: report.sent_at,
        body_preview: body.substring(0, 100)
      });
    }

    res.status(201).json({
      success: true,
      report,
      message: "Report sent successfully"
    });
  } catch (error) {
    console.error("Send doctor report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Reply to report from doctor
// @route   POST /api/doctor/reports/:id/reply
// @access  Private
export const replyToDoctorReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }

    const isParticipant = (
      (parentReport.sender_id === req.user.id && parentReport.sender_type === 'staff') ||
      (parentReport.recipient_id === req.user.id && parentReport.recipient_type === 'staff')
    );

    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized to reply to this report" 
      });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ 
        success: false, 
        message: "Sender not found" 
      });
    }

    const recipientId = parentReport.sender_id === req.user.id ? 
      parentReport.recipient_id : parentReport.sender_id;
    const recipientType = parentReport.sender_id === req.user.id ? 
      parentReport.recipient_type : parentReport.sender_type;

    // ✅ FIX: Get the correct hospital ID for the recipient
    let recipientHospitalId = null;
    
    if (recipientType === 'hospital') {
      if (parentReport.sender_id === req.user.id) {
        recipientHospitalId = parentReport.recipient_hospital_id || parentReport.recipient_id;
      } else {
        recipientHospitalId = parentReport.sender_hospital_id || parentReport.sender_id;
      }
    } else if (recipientType === 'staff') {
      recipientHospitalId = parentReport.sender_hospital_id || parentReport.sender_id;
    }

    console.log(`📡 Recipient - Type: ${recipientType}, ID: ${recipientId}, Hospital ID: ${recipientHospitalId}`);

    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({
      order: [['id', 'DESC']],
      attributes: ['report_number']
    });
    
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      } else {
        const totalCount = await Report.count();
        nextNumber = totalCount + 1;
      }
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

    // Get recipient info for proper storage
    let recipientHospitalName = '';
    let recipientFirstName = '';
    let recipientMiddleName = '';
    let recipientLastName = '';
    let recipientFullName = '';

    if (recipientType === 'hospital') {
      const hospitalAdmin = await HospitalAdmin.findByPk(recipientId);
      if (hospitalAdmin) {
        recipientFirstName = hospitalAdmin.first_name;
        recipientMiddleName = hospitalAdmin.middle_name;
        recipientLastName = hospitalAdmin.last_name;
        recipientFullName = `${hospitalAdmin.first_name} ${hospitalAdmin.middle_name ? hospitalAdmin.middle_name + ' ' : ''}${hospitalAdmin.last_name}`.trim();
        recipientHospitalName = hospitalAdmin.hospital_name;
      }
    } else {
      const staffMember = await HospitalStaff.findByPk(recipientId);
      if (staffMember) {
        recipientFirstName = staffMember.first_name;
        recipientMiddleName = staffMember.middle_name;
        recipientLastName = staffMember.last_name;
        recipientFullName = `${staffMember.first_name} ${staffMember.middle_name ? staffMember.middle_name + ' ' : ''}${staffMember.last_name}`.trim();
      }
    }

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject,
      body,
      priority: parentReport.priority,
      status: 'sent',
      
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Doctor - ${sender.department || 'Medical'} Department`,
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      sender_department: sender.department,
      
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
      // ✅ FIX: Build correct room name based on recipient type
      let recipientRoom = '';
      
      if (recipientType === 'hospital') {
        recipientRoom = `hospital_${recipientHospitalId}_admin`;
      } else if (recipientType === 'staff') {
        recipientRoom = `hospital_${recipientHospitalId}_doctor_${recipientId}`;
      }
      
      console.log(`📡 Emitting 'report_reply_from_doctor' to room: ${recipientRoom}`);
      
      io.to(recipientRoom).emit('report_reply_from_doctor', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
        sender_department: sender.department,
        sender_ward: sender.ward,
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
    console.error("Doctor reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get unread report count for doctor
// @route   GET /api/doctor/reports/unread-count
// @access  Private
export const getDoctorUnreadReportCount = async (req, res) => {
  try {
    const unreadCount = await Report.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        is_opened: false
      }
    });
    
    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error("Get unread report count error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mark report as read
// @route   PUT /api/doctor/reports/:id/read
// @access  Private
export const markDoctorReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        recipient_id: req.user.id,
        recipient_type: 'staff'
      }
    });

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }

    await report.update({
      is_opened: true,
      opened_at: new Date(),
      opened_count: (report.opened_count || 0) + 1
    });

    res.json({
      success: true,
      message: "Report marked as read"
    });
  } catch (error) {
    console.error("Mark report read error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== HOSPITAL STAFF FOR DOCTOR ====================

// @desc    Get all staff members in same hospital for sending reports
// @route   GET /api/doctor/hospital-staff
// @access  Private
export const getHospitalStaffForDoctor = async (req, res) => {
  try {
    const staff = await HospitalStaff.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        id: { [Op.ne]: req.user.id },
        status: 'active'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'department', 'ward']
    });
    
    const formattedStaff = staff.map(member => ({
      id: member.id,
      full_name: `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`.trim(),
      email: member.email,
      department: member.department,
      ward: member.ward
    }));
    
    res.json({
      success: true,
      staff: formattedStaff
    });
  } catch (error) {
    console.error("Get hospital staff error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

// @desc    Get patient prescriptions
// @route   GET /api/doctor/patient/:patientId/prescriptions
// @access  Private
export const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const patient = await Patient.findByPk(patientId);
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    const prescriptionsHistory = patient.prescriptions_history || [];
    const pendingPrescriptions = prescriptionsHistory.filter(p => p.status === 'pending');
    
    res.json({
      success: true,
      prescriptions: pendingPrescriptions,
      all_prescriptions: prescriptionsHistory
    });
    
  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Check lab results for specific patient
// @route   GET /api/doctor/check-lab-results/:patientId
// @access  Private
export const checkLabResults = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctor_id, hospital_id } = req.query;

    if (!hospital_id) {
      return res.json({
        success: true,
        patient_id: patientId,
        hasResults: false,
        completedCount: 0,
        pendingCount: 0,
        results: [],
        pending: []
      });
    }

    const whereClause = {
      patient_id: patientId,
      hospital_id: hospital_id
    };
    
    if (doctor_id) {
      whereClause.doctor_id = doctor_id;
    }

    const labRequests = await LabRequest.findAll({
      where: whereClause,
      include: [{
        model: LabResult,
        as: 'result',
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    const completedLabs = labRequests.filter(req => req.status === 'completed' && req.result);
    const pendingLabs = labRequests.filter(req => req.status !== 'completed' && req.status !== 'cancelled');

    res.json({
      success: true,
      patient_id: patientId,
      hasResults: completedLabs.length > 0,
      completedCount: completedLabs.length,
      pendingCount: pendingLabs.length,
      results: completedLabs.map(req => ({
        id: req.result.id,
        request_id: req.id,
        test_name: req.test_name,
        result: req.result.result,
        critical: req.result.critical,
        reported_at: req.result.reported_at
      })),
      pending: pendingLabs.map(req => ({
        request_id: req.id,
        test_name: req.test_name,
        status: req.status,
        priority: req.priority
      }))
    });

  } catch (error) {
    console.error('❌ Error checking lab results:', error);
    res.json({ 
      success: true,
      patient_id: req.params.patientId,
      hasResults: false,
      completedCount: 0,
      pendingCount: 0,
      results: [],
      pending: []
    });
  }
};

// @desc    Get all beds for a ward
// @route   GET /api/doctor/ward-beds
// @access  Private
export const getWardBeds = async (req, res) => {
  try {
    const { ward, hospital_id, status } = req.query;
    
    if (!ward || !hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'Ward and hospital_id are required'
      });
    }

    const whereClause = {
      hospital_id: parseInt(hospital_id),
      ward: ward
    };
    
    if (status) {
      whereClause.status = status;
    }

    const beds = await Bed.findAll({
      where: whereClause,
      order: [['number', 'ASC']]
    });

    res.json({
      success: true,
      beds: beds.map(bed => ({
        id: bed.id,
        number: bed.number,
        type: bed.type,
        status: bed.status,
        ward: bed.ward,
        current_patient_id: bed.current_patient_id,
        current_patient_name: bed.current_patient_name,
        notes: bed.notes
      }))
    });

  } catch (error) {
    console.error('Error fetching ward beds:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beds',
      error: error.message
    });
  }
};

// @desc    Check for new lab results (polling endpoint)
// @route   GET /api/doctor/check-new-results
// @access  Private
export const checkNewResults = async (req, res) => {
  try {
    const { doctor_id, hospital_id, last_check } = req.query;

    const patients = await Patient.findAll({
      where: {
        doctor_id: doctor_id,
        hospital_id: hospital_id,
        status: {
          [Op.notIn]: ['discharged', 'referred', 'admitted', 'completed']
        }
      },
      attributes: ['id', 'first_name', 'last_name']
    });

    const patientIds = patients.map(p => p.id);

    if (patientIds.length === 0) {
      return res.json({
        success: true,
        hasNewResults: false,
        results: []
      });
    }

    const sinceDate = last_check ? new Date(last_check) : new Date(Date.now() - 60000);
    
    const newResults = await LabResult.findAll({
      where: {
        patient_id: {
          [Op.in]: patientIds
        },
        reported_at: {
          [Op.gt]: sinceDate
        }
      },
      include: [{
        model: LabRequest,
        as: 'lab_request',
        attributes: ['test_name', 'priority']
      }]
    });

    res.json({
      success: true,
      hasNewResults: newResults.length > 0,
      count: newResults.length,
      results: newResults
    });

  } catch (error) {
    console.error('❌ Error checking new results:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// ==================== DOCTOR PROFILE MANAGEMENT ====================

// @desc    Get doctor profile
// @route   GET /api/doctor/profile
// @access  Private
export const getDoctorProfile = async (req, res) => {
  try {
    const doctor = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: "Doctor not found" 
      });
    }
    
    res.json({ 
      success: true, 
      doctor: {
        ...doctor.toJSON(),
        full_name: `${doctor.first_name} ${doctor.middle_name ? doctor.middle_name + ' ' : ''}${doctor.last_name}`.trim(),
        emergency_contact: doctor.emergency_contact || { name: null, phone: null, relationship: null }
      }
    });
  } catch (error) {
    console.error("Get doctor profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Update doctor profile
// @route   PUT /api/doctor/profile
// @access  Private
export const updateDoctorProfile = async (req, res) => {
  try {
    const { 
      first_name, middle_name, last_name, gender, age, phone,
      specialization, license_number, years_of_experience,
      emergency_contact, bio
    } = req.body;
    
    const doctor = await HospitalStaff.findByPk(req.user.id);
    
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: "Doctor not found" 
      });
    }
    
    await doctor.update({
      first_name: first_name || doctor.first_name,
      middle_name: middle_name !== undefined ? middle_name : doctor.middle_name,
      last_name: last_name || doctor.last_name,
      gender: gender || doctor.gender,
      age: age || doctor.age,
      phone: phone !== undefined ? phone : doctor.phone,
      specialization: specialization !== undefined ? specialization : doctor.specialization,
      license_number: license_number !== undefined ? license_number : doctor.license_number,
      years_of_experience: years_of_experience !== undefined ? years_of_experience : doctor.years_of_experience,
      emergency_contact: emergency_contact || doctor.emergency_contact,
      bio: bio !== undefined ? bio : doctor.bio
    });
    
    const updatedDoctor = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      doctor: {
        ...updatedDoctor.toJSON(),
        full_name: `${updatedDoctor.first_name} ${updatedDoctor.middle_name ? updatedDoctor.middle_name + ' ' : ''}${updatedDoctor.last_name}`.trim()
      },
      message: "Profile updated successfully" 
    });
  } catch (error) {
    console.error("Update doctor profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Change doctor password
// @route   PUT /api/doctor/change-password
// @access  Private
export const changeDoctorPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const doctor = await HospitalStaff.findByPk(req.user.id);
    
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: "Doctor not found" 
      });
    }
    
    const isMatch = await bcrypt.compare(current_password, doctor.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await doctor.update({ password: hashedPassword });
    
    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== REPORT REMINDER MANAGEMENT ====================

// @desc    Set reminder for report
// @route   POST /api/doctor/reports/:id/reminder
// @access  Private
export const setReportReminder = async (req, res) => {
  try {
    const { reminder_date, reminder_time, frequency, message } = req.body;
    const report = await Report.findByPk(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }
    
    const isParticipant = (
      (report.sender_id === req.user.id && report.sender_type === 'staff') ||
      (report.recipient_id === req.user.id && report.recipient_type === 'staff')
    );
    
    if (!isParticipant) {
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized to set reminder for this report" 
      });
    }
    
    let reminderDateTime = null;
    if (reminder_date) {
      reminderDateTime = new Date(reminder_date);
      if (reminder_time) {
        const [hours, minutes] = reminder_time.split(':');
        reminderDateTime.setHours(parseInt(hours), parseInt(minutes), 0);
      } else {
        reminderDateTime.setHours(9, 0, 0);
      }
    }
    
    await report.update({
      reminder_date: reminderDateTime,
      reminder_frequency: frequency || 'once',
      reminder_message: message || null,
      reminder_sent: false
    });
    
    res.json({
      success: true,
      message: "Reminder set successfully",
      reminder: {
        date: reminderDateTime,
        frequency: frequency || 'once',
        message: message || null
      }
    });
  } catch (error) {
    console.error("Set reminder error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get doctor's reminders
// @route   GET /api/doctor/reports/reminders
// @access  Private
export const getDoctorReminders = async (req, res) => {
  try {
    const reminders = await Report.findAll({
      where: {
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'staff' },
          { recipient_id: req.user.id, recipient_type: 'staff' }
        ],
        reminder_date: { [Op.not]: null },
        reminder_sent: false,
        reminder_date: { [Op.gte]: new Date() }
      },
      attributes: ['id', 'title', 'report_number', 'reminder_date', 'reminder_frequency', 'reminder_message'],
      order: [['reminder_date', 'ASC']]
    });
    
    res.json({
      success: true,
      reminders
    });
  } catch (error) {
    console.error("Get reminders error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// Add at the end of doctorController.js

// @desc    Get doctor's schedule (REAL API - NO MOCK)
// @route   GET /api/doctor/my-schedule
// @access  Private
export const getDoctorSchedule = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const hospitalId = req.user.hospital_id;
    const { days = 60 } = req.query;
    
    // Try to get from Schedule table
    let schedules = [];
    try {
      const Schedule = require('../models/Schedule.js').default;
      
      schedules = await Schedule.findAll({
        where: {
          staff_id: doctorId,
          hospital_id: hospitalId,
          date: { [Op.gte]: new Date() }
        },
        order: [['date', 'ASC']],
        limit: parseInt(days)
      });
    } catch (err) {
      // Schedule table might not exist yet
      console.log('Schedule table not found');
    }
    
    const getShiftDisplay = (shiftType) => {
      const shifts = {
        morning: { name: 'Morning', start: '08:00', end: '16:00', hours: 8, icon: '🌅' },
        afternoon: { name: 'Afternoon', start: '13:00', end: '21:00', hours: 8, icon: '☀️' },
        night: { name: 'Night', start: '22:00', end: '06:00', hours: 8, icon: '🌙' }
      };
      return shifts[shiftType] || { name: shiftType, start: '--:--', end: '--:--', hours: 0, icon: '📅' };
    };
    
    const formattedSchedules = schedules.map(s => {
      const shift = getShiftDisplay(s.shift_type);
      return {
        id: s.id,
        shift_type: s.shift_type,
        shift_name: shift.name,
        shift_icon: shift.icon,
        start_time: shift.start,
        end_time: shift.end,
        hours: shift.hours,
        ward: s.ward || req.user.ward || 'OPD',
        date: s.date.toISOString().split('T')[0],
        status: s.status || 'scheduled'
      };
    });
    
    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = formattedSchedules.filter(s => s.date === today);
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    const thisWeekShifts = formattedSchedules.filter(s => {
      const shiftDate = new Date(s.date);
      return shiftDate >= startOfWeek && shiftDate < endOfWeek;
    });
    
    const nextWeekStart = new Date(endOfWeek);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 7);
    
    const nextWeekShifts = formattedSchedules.filter(s => {
      const shiftDate = new Date(s.date);
      return shiftDate >= nextWeekStart && shiftDate < nextWeekEnd;
    });
    
    const calculateTotalHours = (shifts) => shifts.reduce((sum, s) => sum + s.hours, 0);
    
    res.json({
      success: true,
      schedules: formattedSchedules,
      stats: {
        today: {
          shift_count: todayShifts.length,
          total_hours: calculateTotalHours(todayShifts)
        },
        this_week: {
          shift_count: thisWeekShifts.length,
          total_hours: calculateTotalHours(thisWeekShifts)
        },
        next_week: {
          shift_count: nextWeekShifts.length,
          total_hours: calculateTotalHours(nextWeekShifts)
        },
        upcoming: {
          shift_count: formattedSchedules.length,
          total_hours: calculateTotalHours(formattedSchedules)
        }
      },
      count: formattedSchedules.length
    });
    
  } catch (error) {
    console.error('Get doctor schedule error:', error);
    res.json({
      success: true,
      schedules: [],
      stats: {
        today: { shift_count: 0, total_hours: 0 },
        this_week: { shift_count: 0, total_hours: 0 },
        next_week: { shift_count: 0, total_hours: 0 },
        upcoming: { shift_count: 0, total_hours: 0 }
      },
      count: 0
    });
  }
};