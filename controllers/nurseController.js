import Patient from '../models/Patient.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import LabRequest from '../models/LabRequest.js';
import LabResult from '../models/LabResult.js';
import RadiologyRequest from '../models/RadiologyRequest.js';
import RadiologyReport from '../models/RadiologyReport.js';
import Bed from '../models/Bed.js';
import Admission from '../models/Admission.js';
import Prescription from '../models/Prescription.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

// Valid wards
const VALID_WARDS = ['OPD', 'EME', 'ANC', 'IPD', 'ICU'];

// ==================== PATIENT QUEUE ====================

// @desc    Get patient queue for nurse's ward
// @route   GET /api/nurse/queue
// @access  Private
// In nurseController.js - getQueue function

export const getQueue = async (req, res) => {
  try {
    const { ward, hospital_id, nurse_id } = req.query;
    
    console.log(`👩‍⚕️ Fetching queue for nurse: ${nurse_id}, ward: ${ward}, hospital: ${hospital_id}`);

    // ✅ ADD 'in_opd', 'in_emergency', 'in_anc' to the status list
    const queue = await Patient.findAll({
      where: {
        hospital_id: hospital_id,
        ward: ward,
        status: {
          [Op.in]: ['triaged', 'registered', 'in_opd', 'in_emergency', 'in_anc']
        }
      },
      attributes: [
        'id', 'card_number', 'first_name', 'middle_name', 'last_name',
        'age', 'gender', 'phone', 'status', 'ward', 'vitals', 'triage_info',
        'registered_at', 'triaged_at', 'createdAt', 'updatedAt'
      ],
      order: [
        [sequelize.literal(`CASE 
          WHEN triage_info->>'priority' = 'critical' THEN 1
          WHEN triage_info->>'priority' = 'urgent' THEN 2
          WHEN triage_info->>'priority' = 'high' THEN 3
          WHEN triage_info->>'priority' = 'routine' THEN 4
          ELSE 5
        END`), 'ASC'],
        ['triaged_at', 'ASC']
      ]
    });

    // Filter out patients already assigned to a nurse
    const availableQueue = queue.filter(patient => {
      const nurseAssignment = patient.vitals?.nurse_assignment;
      return !nurseAssignment || !nurseAssignment.assigned_nurse_id;
    });

    console.log(`✅ Found ${availableQueue.length} patients in queue`);

    res.json({
      success: true,
      queue: availableQueue
    });

  } catch (error) {
    console.error('❌ Error fetching queue:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== ASSIGN PATIENT TO NURSE ====================

// @desc    Assign patient to nurse
// @route   POST /api/nurse/assign-patient
// @access  Private
// @desc    Assign patient to nurse
// @route   POST /api/nurse/assign-patient
// @access  Private
// @desc    Assign patient to nurse
// @route   POST /api/nurse/assign-patient
// @access  Private
export const assignPatient = async (req, res) => {
  try {
    const { patient_id, nurse_id, nurse_name, ward, hospital_id } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    // Store nurse assignment in vitals JSON field
    let currentVitals = patient.vitals || {};
    currentVitals.nurse_assignment = {
      assigned_nurse_id: nurse_id,
      assigned_nurse_name: nurse_name,
      assigned_at: new Date(),
      status: 'assigned'
    };

    // ✅ Use 'with_doctor' or 'triaged' instead of 'in_progress'
    await patient.update({
      vitals: currentVitals,
      status: 'with_doctor',  // Changed from 'in_progress' to a valid enum value
      updatedAt: new Date()
    });

    const updatedPatient = await Patient.findByPk(patient_id, {
      attributes: [
        'id', 'card_number', 'first_name', 'middle_name', 'last_name',
        'age', 'gender', 'phone', 'status', 'ward', 'vitals', 'triage_info',
        'registered_at', 'triaged_at', 'createdAt', 'updatedAt'
      ]
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_ward_${ward}_nurse`).emit('patient_assigned_to_nurse', {
        patient_id,
        nurse_id,
        nurse_name,
        ward
      });
      
      io.to(`hospital_${hospital_id}_nurse_${nurse_id}`).emit('patient_assigned', {
        patient: updatedPatient
      });
    }

    res.json({
      success: true,
      patient: updatedPatient
    });

  } catch (error) {
    console.error('❌ Error assigning patient to nurse:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get patients assigned to nurse
// @route   GET /api/nurse/assigned-patients
// @access  Private
// @desc    Get patients assigned to nurse
// @route   GET /api/nurse/assigned-patients
// @access  Private
// In nurseController.js - getAssignedPatients function

// @desc    Get patients assigned to nurse
// @route   GET /api/nurse/assigned-patients
// @access  Private
export const getAssignedPatients = async (req, res) => {
  try {
    const { nurse_id, hospital_id, ward } = req.query;

    // ✅ REMOVE 'in_progress' - it doesn't exist in your enum
    const patients = await Patient.findAll({
      where: {
        hospital_id: hospital_id,
        ward: ward,
        status: {
          [Op.in]: ['triaged', 'registered', 'in_opd', 'in_emergency', 'in_anc', 'with_doctor']
        }
      },
      attributes: [
        'id', 'card_number', 'first_name', 'last_name',
        'age', 'gender', 'phone', 'status', 'vitals',
        'bed_id', 'createdAt', 'updatedAt'
      ]
    });

    // Filter patients assigned to this nurse (checking JSON field)
    const assignedPatients = patients.filter(patient => {
      const nurseAssignment = patient.vitals?.nurse_assignment;
      return nurseAssignment && nurseAssignment.assigned_nurse_id === parseInt(nurse_id);
    });

    const enhancedPatients = assignedPatients.map(patient => {
      const data = patient.toJSON();
      const nurseAssignment = data.vitals?.nurse_assignment || {};
      const vitals = data.vitals || {};
      
      return {
        id: data.id,
        card_number: data.card_number,
        first_name: data.first_name,
        last_name: data.last_name,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        status: data.status,
        vitals: vitals,
        assigned_nurse_id: nurseAssignment.assigned_nurse_id,
        assigned_nurse_name: nurseAssignment.assigned_nurse_name,
        nursing_care_started_at: nurseAssignment.assigned_at,
        bed_id: data.bed_id,
        bed_number: null,
        last_vitals_time: vitals.last_recorded_at || null,
        care_status: data.status === 'with_doctor' ? 'With Doctor' : 'Waiting'
      };
    });

    res.json({
      success: true,
      patients: enhancedPatients
    });

  } catch (error) {
    console.error('❌ Error fetching assigned patients:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// ==================== SAVE VITALS ====================

// @desc    Save patient vitals
// @route   POST /api/nurse/save-vitals
// @access  Private
export const saveVitals = async (req, res) => {
  try {
    const { 
      patient_id, vitals, nurse_id, nurse_name, hospital_id, ward 
    } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    let currentVitals = patient.vitals || {};
    
    // Store vitals with history
    const vitalsHistory = currentVitals.history || [];
    vitalsHistory.push({
      recorded_at: new Date(),
      recorded_by: nurse_name,
      recorded_by_id: nurse_id,
      temperature: vitals.temperature,
      blood_pressure: vitals.blood_pressure,
      heart_rate: vitals.heart_rate,
      respiratory_rate: vitals.respiratory_rate,
      oxygen_saturation: vitals.oxygen_saturation,
      pain_level: vitals.pain_level,
      weight: vitals.weight,
      height: vitals.height,
      blood_glucose: vitals.blood_glucose,
      chief_complaint: vitals.chief_complaint
    });

    const newVitals = {
      ...currentVitals,
      temperature: vitals.temperature || currentVitals.temperature,
      blood_pressure: vitals.blood_pressure || currentVitals.blood_pressure,
      heart_rate: vitals.heart_rate || currentVitals.heart_rate,
      respiratory_rate: vitals.respiratory_rate || currentVitals.respiratory_rate,
      oxygen_saturation: vitals.oxygen_saturation || currentVitals.oxygen_saturation,
      pain_level: vitals.pain_level || currentVitals.pain_level,
      weight: vitals.weight || currentVitals.weight,
      height: vitals.height || currentVitals.height,
      blood_glucose: vitals.blood_glucose || currentVitals.blood_glucose,
      chief_complaint: vitals.chief_complaint || currentVitals.chief_complaint,
      last_recorded_at: new Date(),
      last_recorded_by: nurse_name,
      history: vitalsHistory.slice(-20) // Keep last 20 records
    };

    await patient.update({
      vitals: newVitals,
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_doctor`).emit('vitals_updated', {
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        nurse_name,
        vitals: vitals,
        recorded_at: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Vitals saved successfully',
      vitals: newVitals
    });

  } catch (error) {
    console.error('❌ Error saving vitals:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== GET VITALS HISTORY ====================

// @desc    Get vitals history for patient
// @route   GET /api/nurse/vitals-history/:patientId
// @access  Private
export const getVitalsHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findByPk(patientId, {
      attributes: ['vitals']
    });

    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    const vitals = patient.vitals || {};
    const history = vitals.history || [];

    res.json({
      success: true,
      vitals: history.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    });

  } catch (error) {
    console.error('❌ Error fetching vitals history:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== SAVE NURSING NOTES ====================

// @desc    Save nursing notes
// @route   POST /api/nurse/save-notes
// @access  Private
export const saveNursingNotes = async (req, res) => {
  try {
    const { patient_id, notes, nurse_id, nurse_name, hospital_id, ward } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    let currentNursingNotes = patient.vitals?.nursing_notes || [];
    
    currentNursingNotes.push({
      id: Date.now(),
      notes: notes,
      nurse_id: nurse_id,
      nurse_name: nurse_name,
      created_at: new Date(),
      hospital_id: hospital_id,
      ward: ward
    });

    let currentVitals = patient.vitals || {};
    currentVitals.nursing_notes = currentNursingNotes;

    await patient.update({
      vitals: currentVitals,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Nursing notes saved successfully',
      notes: currentNursingNotes
    });

  } catch (error) {
    console.error('❌ Error saving nursing notes:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== COMPLETE CARE TASK ====================

// @desc    Mark care task as completed
// @route   PUT /api/nurse/complete-task/:taskId
// @access  Private
export const completeCareTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { patient_id, nurse_id } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    let careTasks = patient.vitals?.care_tasks || [];
    
    const taskIndex = careTasks.findIndex(t => t.id === parseInt(taskId) || t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found' 
      });
    }

    careTasks[taskIndex] = {
      ...careTasks[taskIndex],
      status: 'completed',
      completed_at: new Date(),
      completed_by: nurse_id
    };

    let currentVitals = patient.vitals || {};
    currentVitals.care_tasks = careTasks;

    await patient.update({
      vitals: currentVitals,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Task completed successfully',
      task: careTasks[taskIndex]
    });

  } catch (error) {
    console.error('❌ Error completing care task:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== COMPLETE PATIENT CARE ====================

// @desc    Complete patient care and handover
// @route   POST /api/nurse/complete-care
// @access  Private
// @desc    Complete patient care and handover
// @route   POST /api/nurse/complete-care
// @access  Private

// @desc    Complete patient care and handover
// @route   POST /api/nurse/complete-care
// @access  Private
export const completePatientCare = async (req, res) => {
  try {
    const { 
      patient_id, nurse_id, nurse_name, vitals, nursing_notes,
      medications_administered, care_tasks_completed 
    } = req.body;

    const patient = await Patient.findByPk(patient_id);
    
    if (!patient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Patient not found' 
      });
    }

    let currentVitals = patient.vitals || {};

    // Update vitals if provided
    if (vitals && Object.values(vitals).some(v => v)) {
      const vitalsHistory = currentVitals.history || [];
      vitalsHistory.push({
        recorded_at: new Date(),
        recorded_by: nurse_name,
        ...vitals
      });

      currentVitals = {
        ...currentVitals,
        ...vitals,
        last_recorded_at: new Date(),
        last_recorded_by: nurse_name,
        history: vitalsHistory.slice(-20)
      };
    }

    // Add nursing notes
    if (nursing_notes) {
      const nursingNotesList = currentVitals.nursing_notes || [];
      nursingNotesList.push({
        id: Date.now(),
        notes: nursing_notes,
        nurse_id: nurse_id,
        nurse_name: nurse_name,
        created_at: new Date(),
        type: 'final_note'
      });
      currentVitals.nursing_notes = nursingNotesList;
    }

    // Add administered medications
    if (medications_administered && medications_administered.length > 0) {
      const medsList = currentVitals.medications_administered || [];
      medsList.push(...medications_administered.map(med => ({
        ...med,
        administered_at: new Date(),
        administered_by: nurse_name,
        nurse_id: nurse_id
      })));
      currentVitals.medications_administered = medsList;
    }

    // Update care tasks
    if (care_tasks_completed && care_tasks_completed.length > 0) {
      let careTasks = currentVitals.care_tasks || [];
      const updatedTasks = careTasks.map(task => {
        const completed = care_tasks_completed.find(ct => ct.id === task.id);
        if (completed) {
          return {
            ...task,
            status: 'completed',
            completed_at: new Date(),
            completed_by: nurse_id
          };
        }
        return task;
      });
      currentVitals.care_tasks = updatedTasks;
    }

    // Update nurse assignment status
    currentVitals.nurse_assignment = {
      ...currentVitals.nurse_assignment,
      status: 'completed',
      completed_at: new Date(),
      completed_by: nurse_name
    };

    // ✅ Update patient status to 'triaged' (available for doctor again)
    await patient.update({
      vitals: currentVitals,
      status: 'triaged',  // Valid enum value
      updatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${patient.hospital_id}_doctor`).emit('nursing_care_completed', {
        patient_id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        nurse_name,
        completed_at: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Patient care completed successfully'
    });

  } catch (error) {
    console.error('❌ Error completing patient care:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// ==================== NURSE STATS ====================

// @desc    Get nurse stats
// @route   GET /api/nurse/stats
// @access  Private
// ==================== NURSE STATS ====================

// @desc    Get nurse stats
// @route   GET /api/nurse/stats
// @access  Private
// In nurseController.js - getStats function

// @desc    Get nurse stats
// @route   GET /api/nurse/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const { ward, hospital_id, nurse_id } = req.query;

    console.log(`📊 Fetching stats for nurse: ${nurse_id}, hospital: ${hospital_id}, ward: ${ward}`);

    const nurse = await HospitalStaff.findByPk(nurse_id, {
      attributes: ['first_name', 'last_name']
    });
    const nurse_name = nurse ? `${nurse.first_name} ${nurse.last_name}` : `Nurse_${nurse_id}`;

    // ✅ REMOVE 'in_progress' - it doesn't exist in your enum
    const allPatients = await Patient.findAll({
      where: {
        hospital_id,
        ward,
        status: {
          [Op.in]: ['triaged', 'registered', 'in_opd', 'in_emergency', 'in_anc', 'with_doctor']
        }
      },
      attributes: ['id', 'status', 'vitals', 'updatedAt']
    });

    // Waiting patients (not assigned to any nurse)
    const waiting = allPatients.filter(p => 
      (p.status === 'triaged' || p.status === 'registered' || p.status === 'in_opd' || p.status === 'in_emergency' || p.status === 'in_anc') &&
      (!p.vitals?.nurse_assignment || !p.vitals.nurse_assignment.assigned_nurse_id)
    ).length;

    // In progress patients (assigned to this nurse)
    const inProgress = allPatients.filter(p => 
      p.vitals?.nurse_assignment?.assigned_nurse_id === parseInt(nurse_id)
    ).length;

    // Completed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completed = allPatients.filter(p => 
      p.vitals?.nurse_assignment?.completed_by === nurse_name &&
      p.vitals?.nurse_assignment?.completed_at &&
      new Date(p.vitals.nurse_assignment.completed_at) >= today
    ).length;

    // Pending vitals (assigned but no vitals recorded today)
    const pendingVitals = allPatients.filter(p => 
      p.vitals?.nurse_assignment?.assigned_nurse_id === parseInt(nurse_id) &&
      (!p.vitals?.last_recorded_at || new Date(p.vitals.last_recorded_at) < today)
    ).length;

    // Admitted patients in ward
    const admitted = await Patient.count({
      where: {
        hospital_id,
        ward,
        status: 'admitted'
      }
    }).catch(() => 0);

    // Discharged today
    const discharged = await Patient.count({
      where: {
        hospital_id,
        status: 'discharged',
        updatedAt: {
          [Op.gte]: today
        }
      }
    }).catch(() => 0);

    res.json({
      success: true,
      stats: {
        waiting: waiting || 0,
        inProgress: inProgress || 0,
        completed: completed || 0,
        pendingVitals: pendingVitals || 0,
        admitted: admitted || 0,
        discharged: discharged || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching nurse stats:', error);
    res.json({
      success: true,
      stats: {
        waiting: 0,
        inProgress: 0,
        completed: 0,
        pendingVitals: 0,
        admitted: 0,
        discharged: 0
      }
    });
  }
};

// ==================== REPORT MANAGEMENT FOR NURSES ====================

// @desc    Get reports inbox for nurse
// @route   GET /api/nurse/reports/inbox
// @access  Private
// @desc    Get reports inbox for nurse
// @route   GET /api/nurse/reports/inbox
// @access  Private
export const getNurseReportsInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', priority } = req.query;
    const offset = (page - 1) * limit;
    
    // Use 'staff' instead of 'nurse'
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'  // Changed from 'nurse' to 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { sender_full_name: { [Op.like]: `%${search}%` } }
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
        recipient_type: 'staff',  // Changed from 'nurse' to 'staff'
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
    console.error("❌ Get nurse reports inbox error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// @desc    Get nurse sent reports (outbox)
// @route   GET /api/nurse/reports/outbox
// @access  Private
// @desc    Get nurse sent reports (outbox)
// @route   GET /api/nurse/reports/outbox
// @access  Private
export const getNurseReportsOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // Use 'staff' instead of 'nurse'
    const whereClause = {
      sender_id: req.user.id,
      sender_type: 'staff'  // Changed from 'nurse' to 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { recipient_full_name: { [Op.like]: `%${search}%` } }
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
    console.error("❌ Get nurse reports outbox error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// ==================== STAFF LISTS FOR REPORTS ====================

// @desc    Get hospital admins for nurse
// @route   GET /api/nurse/hospital-admins
// @access  Private
export const getHospitalAdminsForNurse = async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    
    const admins = await HospitalAdmin.findAll({
      where: { id: hospitalId },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    const formattedAdmins = admins.map(admin => ({
      id: admin.id,
      full_name: `${admin.first_name} ${admin.middle_name ? admin.middle_name + ' ' : ''}${admin.last_name}`.trim(),
      email: admin.email,
      hospital_name: admin.hospital_name
    }));
    
    res.json({
      success: true,
      admins: formattedAdmins
    });
  } catch (error) {
    console.error("❌ Get hospital admins error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get doctors for nurse
// @route   GET /api/nurse/doctors
// @access  Private
export const getDoctorsForNurse = async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    
    const doctors = await HospitalStaff.findAll({
      where: {
        hospital_id: hospitalId,
        role: 'doctor',
        status: 'active'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'specialization', 'ward']
    });
    
    const formattedDoctors = doctors.map(doc => ({
      id: doc.id,
      full_name: `${doc.first_name} ${doc.middle_name ? doc.middle_name + ' ' : ''}${doc.last_name}`.trim(),
      email: doc.email,
      specialization: doc.specialization,
      ward: doc.ward
    }));
    
    res.json({
      success: true,
      doctors: formattedDoctors
    });
  } catch (error) {
    console.error("❌ Get doctors error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get pharmacy staff for nurse
// @route   GET /api/nurse/pharmacy-staff
// @access  Private
export const getPharmacyStaffForNurse = async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    
    const staff = await HospitalStaff.findAll({
      where: {
        hospital_id: hospitalId,
        role: 'pharmacy_staff',
        status: 'active'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'department']
    });
    
    const formattedStaff = staff.map(member => ({
      id: member.id,
      full_name: `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`.trim(),
      email: member.email,
      department: member.department
    }));
    
    res.json({
      success: true,
      staff: formattedStaff
    });
  } catch (error) {
    console.error("❌ Get pharmacy staff error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get lab staff for nurse
// @route   GET /api/nurse/lab-staff
// @access  Private
export const getLabStaffForNurse = async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    
    const staff = await HospitalStaff.findAll({
      where: {
        hospital_id: hospitalId,
        role: 'lab_staff',
        status: 'active'
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'department']
    });
    
    const formattedStaff = staff.map(member => ({
      id: member.id,
      full_name: `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`.trim(),
      email: member.email,
      department: member.department
    }));
    
    res.json({
      success: true,
      staff: formattedStaff
    });
  } catch (error) {
    console.error("❌ Get lab staff error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get all staff for nurse
// @route   GET /api/nurse/all-staff
// @access  Private
export const getAllStaffForNurse = async (req, res) => {
  try {
    const hospitalId = req.user.hospital_id;
    
    const staff = await HospitalStaff.findAll({
      where: {
        hospital_id: hospitalId,
        role: {
          [Op.in]: ['doctor', 'pharmacy_staff', 'lab_staff', 'nurse']
        },
        status: 'active',
        id: { [Op.ne]: req.user.id }
      },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'role', 'department', 'ward']
    });
    
    const formattedStaff = staff.map(member => ({
      id: member.id,
      full_name: `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`.trim(),
      email: member.email,
      role: member.role,
      department: member.department,
      ward: member.ward
    }));
    
    res.json({
      success: true,
      staff: formattedStaff
    });
  } catch (error) {
    console.error("❌ Get all staff error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== NURSE PROFILE MANAGEMENT ====================

// @desc    Get nurse profile
// @route   GET /api/nurse/profile
// @access  Private
export const getNurseProfile = async (req, res) => {
  try {
    const nurse = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!nurse) {
      return res.status(404).json({ 
        success: false, 
        message: "Nurse not found" 
      });
    }
    
    res.json({ 
      success: true, 
      nurse: {
        ...nurse.toJSON(),
        full_name: `${nurse.first_name} ${nurse.middle_name ? nurse.middle_name + ' ' : ''}${nurse.last_name}`.trim(),
        emergency_contact: nurse.emergency_contact || { name: null, phone: null, relationship: null }
      }
    });
  } catch (error) {
    console.error("❌ Get nurse profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Update nurse profile
// @route   PUT /api/nurse/profile
// @access  Private
export const updateNurseProfile = async (req, res) => {
  try {
    const { 
      first_name, middle_name, last_name, gender, age, phone,
      nurse_type, license_number, years_of_experience,
      emergency_contact, bio
    } = req.body;
    
    const nurse = await HospitalStaff.findByPk(req.user.id);
    
    if (!nurse) {
      return res.status(404).json({ 
        success: false, 
        message: "Nurse not found" 
      });
    }
    
    await nurse.update({
      first_name: first_name || nurse.first_name,
      middle_name: middle_name !== undefined ? middle_name : nurse.middle_name,
      last_name: last_name || nurse.last_name,
      gender: gender || nurse.gender,
      age: age || nurse.age,
      phone: phone !== undefined ? phone : nurse.phone,
      nurse_type: nurse_type !== undefined ? nurse_type : nurse.nurse_type,
      license_number: license_number !== undefined ? license_number : nurse.license_number,
      years_of_experience: years_of_experience !== undefined ? years_of_experience : nurse.years_of_experience,
      emergency_contact: emergency_contact || nurse.emergency_contact,
      bio: bio !== undefined ? bio : nurse.bio
    });
    
    const updatedNurse = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      nurse: {
        ...updatedNurse.toJSON(),
        full_name: `${updatedNurse.first_name} ${updatedNurse.middle_name ? updatedNurse.middle_name + ' ' : ''}${updatedNurse.last_name}`.trim()
      },
      message: "Profile updated successfully" 
    });
  } catch (error) {
    console.error("❌ Update nurse profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Change nurse password
// @route   PUT /api/nurse/change-password
// @access  Private
export const changeNursePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const nurse = await HospitalStaff.findByPk(req.user.id);
    
    if (!nurse) {
      return res.status(404).json({ 
        success: false, 
        message: "Nurse not found" 
      });
    }
    
    const isMatch = await bcrypt.compare(current_password, nurse.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await nurse.update({ password: hashedPassword });
    
    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== SEND REPORT FROM NURSE ====================

// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
// @desc    Send report from nurse
// @route   POST /api/nurse/reports/send
// @access  Private
export const sendNurseReport = async (req, res) => {
  try {
    console.log('📨 Received request to send report');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body after multer:', req.body);
    console.log('req.files:', req.files);
    
    let title, subject, body, priority, recipient_type, recipient_id;
    let attachments = [];
    
    // Check if multer processed the request
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ No form data received.');
      return res.status(400).json({ 
        success: false, 
        message: "No form data received." 
      });
    }
    
    // Extract form fields
    title = req.body.title;
    subject = req.body.subject;
    body = req.body.body;
    priority = req.body.priority;
    recipient_type = req.body.recipient_type;
    recipient_id = req.body.recipient_id;
    
    // Handle files if any
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      }));
      console.log(`📎 Received ${attachments.length} file(s)`);
    }
    
    console.log('Form data extracted:', { 
      title, 
      subject, 
      body: body ? body.substring(0, 50) + '...' : 'undefined', 
      priority, 
      recipient_type, 
      recipient_id 
    });

    // Validate required fields
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    if (!body || body.trim() === '') {
      return res.status(400).json({ success: false, message: "Message body is required" });
    }

    if (!recipient_type) {
      return res.status(400).json({ success: false, message: "Recipient type is required" });
    }

    if (!recipient_id) {
      return res.status(400).json({ success: false, message: "Recipient ID is required" });
    }

    // Get sender (nurse)
    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender (nurse) not found" });
    }

    console.log('👩‍⚕️ Sender found:', sender.first_name, sender.last_name);

    let recipient = null;
    let recipientFullName = '';
    let recipientHospitalId = null;
    let mappedRecipientType = '';
    
    // Map recipient type
    if (recipient_type === 'hospital_admin') {
      recipient = await HospitalAdmin.findByPk(recipient_id);
      if (!recipient) {
        return res.status(404).json({ success: false, message: "Hospital admin not found" });
      }
      recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      recipientHospitalId = recipient.id;
      mappedRecipientType = 'hospital';
    } 
    else if (recipient_type === 'doctor') {
      recipient = await HospitalStaff.findByPk(recipient_id);
      if (!recipient || recipient.role !== 'doctor') {
        return res.status(404).json({ success: false, message: "Doctor not found" });
      }
      recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      recipientHospitalId = recipient.hospital_id;
      mappedRecipientType = 'staff';
    }
    else if (recipient_type === 'pharmacy') {
      recipient = await HospitalStaff.findByPk(recipient_id);
      if (!recipient || recipient.role !== 'pharmacy_staff') {
        return res.status(404).json({ success: false, message: "Pharmacy staff not found" });
      }
      recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      recipientHospitalId = recipient.hospital_id;
      mappedRecipientType = 'staff';
    }
    else if (recipient_type === 'lab') {
      recipient = await HospitalStaff.findByPk(recipient_id);
      if (!recipient || recipient.role !== 'lab_staff') {
        return res.status(404).json({ success: false, message: "Lab staff not found" });
      }
      recipientFullName = `${recipient.first_name} ${recipient.middle_name ? recipient.middle_name + ' ' : ''}${recipient.last_name}`.trim();
      recipientHospitalId = recipient.hospital_id;
      mappedRecipientType = 'staff';
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Invalid recipient type. Must be: hospital_admin, doctor, pharmacy, or lab"
      });
    }

    console.log('👤 Recipient found:', recipientFullName);

    // ==================== GENERATE UNIQUE REPORT NUMBER ====================
    const date = new Date();
    const year = date.getFullYear();

    // Get the last report to determine next sequence
    const lastReport = await Report.findOne({
      order: [['id', 'DESC']],
      attributes: ['report_number']
    });

    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-(\d+)-(\d+)/);
      if (match) {
        const lastYear = parseInt(match[1]);
        const lastSeq = parseInt(match[2]);
        
        if (lastYear === year) {
          nextNumber = lastSeq + 1;
        } else {
          nextNumber = 1;
        }
      }
    }

    // Ensure unique report number
    let report_number;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      report_number = `RPT-${year}-${String(nextNumber + attempts).padStart(4, '0')}`;
      
      const existingReport = await Report.findOne({
        where: { report_number }
      });
      
      if (!existingReport) {
        isUnique = true;
      }
      
      attempts++;
    }

    if (!isUnique) {
      // Fallback to timestamp-based unique number
      report_number = `RPT-${year}-${Date.now()}`;
    }

    console.log('📄 Generated unique report number:', report_number);

    // Prepare attachments JSON
    let attachmentsJson = [];
    if (attachments.length > 0) {
      attachmentsJson = attachments.map(att => ({
        filename: att.filename,
        originalName: att.originalname,
        url: `/uploads/reports/${att.filename}`,
        size: att.size,
        type: att.mimetype,
        uploaded_at: new Date()
      }));
    }

    // Create the report
    const report = await Report.create({
      report_number,
      title: title.trim(),
      subject: subject || title.trim(),
      body: body.trim(),
      priority: priority || 'medium',
      status: 'sent',
      attachments: attachmentsJson,
      
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Nurse - ${sender.ward || sender.department || 'Nursing'} Department`,
      sender_hospital: sender.hospital_name,
      sender_department: sender.department,
      
      recipient_id: recipient.id,
      recipient_type: mappedRecipientType,
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipient.hospital_name,
      recipient_department: recipient.department,
      
      sent_at: new Date(),
      last_activity_at: new Date()
    });

    console.log(`✅ Report created with ID: ${report.id}`);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      
      if (recipient_type === 'hospital_admin') {
        recipientRoom = `hospital_${recipientHospitalId}_admin`;
      } else if (recipient_type === 'doctor') {
        recipientRoom = `hospital_${recipientHospitalId}_doctor_${recipient.id}`;
      } else if (recipient_type === 'pharmacy') {
        recipientRoom = `hospital_${recipientHospitalId}_pharmacy`;
      } else if (recipient_type === 'lab') {
        recipientRoom = `hospital_${recipientHospitalId}_lab`;
      }
      
      console.log(`📡 Emitting to room: ${recipientRoom}`);
      io.to(recipientRoom).emit('new_report_from_nurse', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        sender_ward: sender.ward,
        sent_at: report.sent_at,
        body_preview: body.substring(0, 100),
        has_attachments: attachments.length > 0
      });
    }

    res.status(201).json({
      success: true,
      report,
      message: "Report sent successfully"
    });
    
  } catch (error) {
    console.error("❌ Send nurse report error:", error);
    
    // Handle duplicate key error specifically
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        success: false, 
        message: "A report with this number already exists. Please try again.",
        error: "Duplicate report number"
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error"
    });
  }
};
// @desc    Reply to report from nurse
// @route   POST /api/nurse/reports/:id/reply
// @access  Private
// @desc    Reply to report from nurse
// @route   POST /api/nurse/reports/:id/reply
// @access  Private
export const replyToNurseReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }

    // Check if user is participant using 'staff' type
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

    // Get recipient info
    let recipientFirstName = '';
    let recipientMiddleName = '';
    let recipientLastName = '';
    let recipientFullName = '';
    let recipientHospitalName = '';

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
        recipientHospitalName = staffMember.hospital_name;
      }
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
      }
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject,
      body,
      priority: parentReport.priority,
      status: 'sent',
      
      sender_id: sender.id,
      sender_type: 'staff',  // Use 'staff' for nurses
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: `${sender.first_name} ${sender.middle_name ? sender.middle_name + ' ' : ''}${sender.last_name}`.trim(),
      sender_title: `Nurse - ${sender.ward || 'Nursing'} Department`,
      sender_hospital: sender.hospital_name,
      sender_department: sender.department,
      
      recipient_id: recipientId,
      recipient_type: recipientType,
      recipient_first_name: recipientFirstName,
      recipient_middle_name: recipientMiddleName,
      recipient_last_name: recipientLastName,
      recipient_full_name: recipientFullName,
      recipient_hospital: recipientHospitalName,
      
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
        recipientRoom = `hospital_${parentReport.sender_hospital_id || parentReport.recipient_hospital_id}_admin`;
      } else if (recipientType === 'staff') {
        recipientRoom = `hospital_${parentReport.sender_hospital_id}_doctor_${recipientId}`;
      }
      
      console.log(`📡 Emitting report_reply_from_nurse to room: ${recipientRoom}`);
      
      io.to(recipientRoom).emit('report_reply_from_nurse', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: `${sender.first_name} ${sender.last_name}`,
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
    console.error("❌ Nurse reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mark report as read for nurse
// @route   PUT /api/nurse/reports/:id/read
// @access  Private
// @desc    Mark report as read for nurse
// @route   PUT /api/nurse/reports/:id/read
// @access  Private
export const markNurseReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
        recipient_id: req.user.id,
        recipient_type: 'staff'  // Changed from 'nurse' to 'staff'
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
    console.error("❌ Mark report read error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Set reminder for report (nurse)
// @route   POST /api/nurse/reports/:id/reminder
// @access  Private
// @desc    Set reminder for report (nurse)
// @route   POST /api/nurse/reports/:id/reminder
// @access  Private
export const setNurseReportReminder = async (req, res) => {
  try {
    const { reminder_date, reminder_time, frequency, message } = req.body;
    const report = await Report.findByPk(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: "Report not found" 
      });
    }
    
    // Check participant using 'staff' type
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
    console.error("❌ Set reminder error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Get nurse's reminders
// @route   GET /api/nurse/reports/reminders
// @access  Private
export const getNurseReminders = async (req, res) => {
  try {
    const reminders = await Report.findAll({
      where: {
        [Op.or]: [
          { sender_id: req.user.id, sender_type: 'nurse' },
          { recipient_id: req.user.id, recipient_type: 'nurse' }
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
    console.error("❌ Get reminders error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};