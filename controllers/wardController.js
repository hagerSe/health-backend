// backend/controllers/wardController.js
import Patient from '../models/Patient.js';
import Visit from '../models/Visit.js';
import Notification from '../models/Notification.js';
import { Op } from 'sequelize';

// Get patients in specific ward
export const getWardPatients = async (req, res) => {
  try {
    const { ward } = req.params; // 'OPD', 'EME', 'ANC'
    
    // Verify user has access to this ward
    if (req.user.ward !== ward && req.user.role !== 'hospital_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this ward' 
      });
    }

    // Map ward to status
    const statusMap = {
      'OPD': 'in_opd',
      'EME': 'in_emergency',
      'ANC': 'in_anc'
    };

    const patients = await Patient.findAll({
      where: {
        hospital_id: req.user.hospital_id,
        ward: ward,
        status: statusMap[ward]
      },
      order: [['triaged_at', 'ASC']] // Oldest first
    });

    res.json({
      success: true,
      patients,
      count: patients.length
    });

  } catch (error) {
    console.error('Error getting ward patients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Start consultation
export const startConsultation = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: req.user.hospital_id
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Verify patient is in correct ward
    if (patient.ward !== req.user.ward) {
      return res.status(403).json({ 
        success: false, 
        message: `This patient is in ${patient.ward} ward, not your ward` 
      });
    }

    // Update patient status
    await patient.update({
      status: 'with_doctor',
      consultation_started_at: new Date(),
      current_doctor_id: req.user.id,
      current_doctor_name: req.user.full_name
    });

    // Update visit
    await Visit.update(
      { 
        status: 'in_consultation',
        doctor_id: req.user.id,
        doctor_name: req.user.full_name,
        started_at: new Date()
      },
      { 
        where: { 
          patient_id: patient.id,
          status: 'active'
        } 
      }
    );

    // Notify the ward that patient is now with doctor
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${req.user.hospital_id}_ward_${patient.ward}`).emit('consultation_started', {
        patient_id: patient.id,
        doctor_name: req.user.full_name
      });
    }

    res.json({
      success: true,
      message: 'Consultation started',
      patient
    });

  } catch (error) {
    console.error('Error starting consultation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Complete consultation
export const completeConsultation = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { diagnosis, prescription, notes, refer_to } = req.body;

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: req.user.hospital_id
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const updateData = {
      status: 'consultation_completed',
      consultation_ended_at: new Date(),
      diagnosis: diagnosis,
      prescription: prescription,
      doctor_notes: notes
    };

    // If referring to another ward
    if (refer_to && refer_to !== patient.ward) {
      const statusMap = {
        'OPD': 'in_opd',
        'EME': 'in_emergency',
        'ANC': 'in_anc'
      };
      
      updateData.ward = refer_to;
      updateData.status = statusMap[refer_to];
      updateData.referred_from = patient.ward;
      updateData.referred_by = req.user.full_name;
      updateData.referred_at = new Date();
      updateData.referral_reason = notes || 'Referred for further evaluation';

      // Create notification for target ward
      const recipientType = refer_to === 'OPD' ? 'opd_doctor' : 
                           refer_to === 'EME' ? 'eme_doctor' : 'anc_nurse';

      await Notification.create({
        recipient_type: recipientType,
        recipient_ward: refer_to,
        hospital_id: req.user.hospital_id,
        title: 'Patient Referred',
        message: `Patient ${patient.first_name} ${patient.last_name} referred from ${patient.ward} Ward`,
        type: 'referral',
        priority: 'medium',
        reference_id: patient.id,
        data: {
          patient_id: patient.id,
          card_number: patient.card_number,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          from_ward: patient.ward,
          to_ward: refer_to,
          diagnosis: diagnosis,
          reason: notes
        }
      });

      // ✅ EMIT SOCKET EVENTS FOR REFERRAL
      const io = req.app.get('io');
      if (io) {
        // Remove from current ward
        io.to(`hospital_${req.user.hospital_id}_ward_${patient.ward}`).emit('patient_removed', {
          patient_id: patient.id
        });
        
        // Add to new ward
        io.to(`hospital_${req.user.hospital_id}_ward_${refer_to}`).emit('new_referral', {
          patient_id: patient.id,
          card_number: patient.card_number,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          from_ward: patient.ward,
          diagnosis: diagnosis,
          reason: notes
        });
      }
    }

    await patient.update(updateData);

    // Update visit
    await Visit.update(
      { 
        status: refer_to ? 'referred' : 'completed',
        diagnosis: diagnosis,
        prescription: prescription,
        doctor_notes: notes,
        ended_at: new Date()
      },
      { 
        where: { 
          patient_id: patient.id,
          status: 'in_consultation'
        } 
      }
    );

    res.json({
      success: true,
      message: refer_to ? `Patient referred to ${refer_to} Ward` : 'Consultation completed',
      patient
    });

  } catch (error) {
    console.error('Error completing consultation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient history
export const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        hospital_id: req.user.hospital_id
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const visits = await Visit.findAll({
      where: { patient_id: patient.id },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      patient,
      visits
    });

  } catch (error) {
    console.error('Error getting patient history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get ward stats
export const getWardStats = async (req, res) => {
  try {
    const { ward } = req.params;

    const waiting = await Patient.count({
      where: {
        hospital_id: req.user.hospital_id,
        ward: ward,
        status: ward === 'OPD' ? 'in_opd' : ward === 'EME' ? 'in_emergency' : 'in_anc'
      }
    });

    const withDoctor = await Patient.count({
      where: {
        hospital_id: req.user.hospital_id,
        ward: ward,
        status: 'with_doctor'
      }
    });

    const completedToday = await Visit.count({
      where: {
        hospital_id: req.user.hospital_id,
        ward: ward,
        status: 'completed',
        ended_at: { [Op.gte]: new Date().setHours(0,0,0,0) }
      }
    });

    res.json({
      success: true,
      stats: {
        waiting,
        withDoctor,
        completedToday
      }
    });

  } catch (error) {
    console.error('Error getting ward stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};