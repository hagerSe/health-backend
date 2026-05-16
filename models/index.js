// models/index.js
import sequelize from "../config/database.js";

// Import all models
import Patient from "./Patient.js";
import LabRequest from "./LabRequest.js";
import LabResult from "./LabResult.js";
import RadiologyRequest from "./RadiologyRequest.js";
import RadiologyReport from "./RadiologyReport.js";
import Prescription from "./Prescription.js";
import Bed from "./Bed.js";
import Admission from "./Admission.js";
import Referral from "./Referral.js";
import AntenatalVisit from "./AntenatalVisit.js";
import DeliveryRecord from "./DeliveryRecord.js";
import Schedule from "./Schedule.js";
import LeaveRequest from "./LeaveRequest.js";
import ShiftSwap from "./ShiftSwap.js";
import FederalAdmin from "./FederalAdmin.js";
import RegionalAdmin from "./RegionalAdmin.js";
import ZoneAdmin from "./ZoneAdmin.js";
import WoredaAdmin from "./WoredaAdmin.js";
import KebeleAdmin from "./KebeleAdmin.js";
import HospitalAdmin from "./HospitalAdmin.js";
import HospitalStaff from "./HospitalStaff.js";
import Medication from "./Medication.js";
import VitalSign from "./VitalSign.js";
import Report from "./Report.js";
import Notification from "./Notification.js";

// ============================================
// FIRST: Define all associations that are NOT in model files
// ============================================

// HIERARCHICAL RELATIONSHIPS
FederalAdmin.hasMany(RegionalAdmin, {
  foreignKey: "federal_id",
  as: "federal_regions",
  onDelete: "RESTRICT"
});

RegionalAdmin.belongsTo(FederalAdmin, {
  foreignKey: "federal_id",
  as: "federal_admin",
  onDelete: "RESTRICT"
});

RegionalAdmin.hasMany(ZoneAdmin, {
  foreignKey: "regional_id",
  as: "regional_zones",
  onDelete: "RESTRICT"
});

ZoneAdmin.belongsTo(RegionalAdmin, {
  foreignKey: "regional_id",
  as: "regional_admin",
  onDelete: "RESTRICT"
});

ZoneAdmin.hasMany(WoredaAdmin, {
  foreignKey: "zone_id",
  as: "zone_woredas",
  onDelete: "RESTRICT"
});

WoredaAdmin.belongsTo(ZoneAdmin, {
  foreignKey: "zone_id",
  as: "zone_admin",
  onDelete: "RESTRICT"
});

WoredaAdmin.hasMany(KebeleAdmin, {
  foreignKey: "woreda_id",
  as: "woreda_kebeles",
  onDelete: "RESTRICT"
});

KebeleAdmin.belongsTo(WoredaAdmin, {
  foreignKey: "woreda_id",
  as: "woreda",
  onDelete: "RESTRICT"
});

KebeleAdmin.hasMany(HospitalAdmin, {
  foreignKey: "kebele_id",
  as: "kebele_hospitals",
  onDelete: "RESTRICT"
});

HospitalAdmin.belongsTo(KebeleAdmin, {
  foreignKey: "kebele_id",
  as: "kebele_admin",
  onDelete: "RESTRICT"
});

HospitalAdmin.hasMany(HospitalStaff, {
  foreignKey: "hospital_id",
  as: "hospital_staff_members",
  onDelete: "RESTRICT"
});

HospitalStaff.belongsTo(HospitalAdmin, {
  foreignKey: "hospital_id",
  as: "hospital_administrator",
  onDelete: "RESTRICT"
});

HospitalAdmin.hasMany(Patient, {
  foreignKey: "hospital_id",
  as: "hospital_patients_list",
  onDelete: "RESTRICT"
});

Patient.belongsTo(HospitalAdmin, {
  foreignKey: "hospital_id",
  as: "patient_hospital",
  onDelete: "RESTRICT"
});

// Patient Relationships (excluding Prescription which is in Prescription model)
Patient.hasMany(VitalSign, {
  foreignKey: "patient_id",
  as: "vital_signs",
  onDelete: "CASCADE"
});

VitalSign.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

Patient.hasMany(Admission, {
  foreignKey: "patient_id",
  as: "admissions",
  onDelete: "CASCADE"
});

Admission.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

Patient.hasMany(Referral, {
  foreignKey: "patient_id",
  as: "referrals",
  onDelete: "CASCADE"
});

Referral.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

Patient.hasMany(AntenatalVisit, {
  foreignKey: "patient_id",
  as: "antenatal_visits",
  onDelete: "CASCADE"
});

AntenatalVisit.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

Patient.hasMany(DeliveryRecord, {
  foreignKey: "patient_id",
  as: "delivery_records",
  onDelete: "CASCADE"
});

DeliveryRecord.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

// Lab Request Relationships
Patient.hasMany(LabRequest, {
  foreignKey: "patient_id",
  as: "lab_requests",
  onDelete: "CASCADE"
});

LabRequest.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

LabRequest.hasOne(LabResult, {
  foreignKey: "lab_request_id",
  as: "result",
  onDelete: "CASCADE"
});

LabResult.belongsTo(LabRequest, {
  foreignKey: "lab_request_id",
  as: "lab_request",
  onDelete: "CASCADE"
});

LabRequest.belongsTo(HospitalStaff, {
  foreignKey: "requested_by",
  as: "requester_staff",
  constraints: false
});

HospitalStaff.hasMany(LabRequest, {
  foreignKey: "requested_by",
  as: "requested_labs",
  constraints: false
});

LabRequest.belongsTo(HospitalAdmin, {
  foreignKey: "hospital_id",
  as: "hospital",
  onDelete: "RESTRICT"
});

HospitalAdmin.hasMany(LabRequest, {
  foreignKey: "hospital_id",
  as: "hospital_lab_requests",
  onDelete: "RESTRICT"
});

// Radiology Relationships
Patient.hasMany(RadiologyRequest, {
  foreignKey: "patient_id",
  as: "radiology_requests",
  onDelete: "CASCADE"
});

RadiologyRequest.belongsTo(Patient, {
  foreignKey: "patient_id",
  as: "patient",
  onDelete: "CASCADE"
});

RadiologyRequest.hasOne(RadiologyReport, {
  foreignKey: "radiology_request_id",
  as: "report",
  onDelete: "CASCADE"
});

RadiologyReport.belongsTo(RadiologyRequest, {
  foreignKey: "radiology_request_id",
  as: "radiology_request",
  onDelete: "CASCADE"
});

RadiologyRequest.belongsTo(HospitalStaff, {
  foreignKey: "requested_by",
  as: "requester_staff",
  constraints: false
});

HospitalStaff.hasMany(RadiologyRequest, {
  foreignKey: "requested_by",
  as: "requested_radiology",
  constraints: false
});

// Midwife Relationships
HospitalStaff.hasMany(Patient, {
  foreignKey: "midwife_id",
  as: "midwife_antenatal_patients",
  constraints: false
});

HospitalStaff.hasMany(AntenatalVisit, {
  foreignKey: "midwife_id",
  as: "midwife_visit_records",
  constraints: false
});

AntenatalVisit.belongsTo(HospitalStaff, {
  foreignKey: "midwife_id",
  as: "visiting_midwife",
  constraints: false
});

HospitalStaff.hasMany(DeliveryRecord, {
  foreignKey: "delivered_by_id",
  as: "midwife_delivery_records",
  constraints: false
});

DeliveryRecord.belongsTo(HospitalStaff, {
  foreignKey: "delivered_by_id",
  as: "delivery_attendant",
  constraints: false
});

// Lab Technician Relationships
HospitalStaff.hasMany(LabResult, {
  foreignKey: "processed_by",
  as: "technician_processed_labs",
  constraints: false
});

LabResult.belongsTo(HospitalStaff, {
  foreignKey: "processed_by",
  as: "processing_technician",
  constraints: false
});

// Radiologist Relationships
HospitalStaff.hasMany(RadiologyReport, {
  foreignKey: "reported_by_id",
  as: "radiologist_reports",
  constraints: false
});

RadiologyReport.belongsTo(HospitalStaff, {
  foreignKey: "reported_by_id",
  as: "reporting_radiologist",
  constraints: false
});

// Pharmacist Relationships
HospitalStaff.hasMany(Prescription, {
  foreignKey: "dispensed_by_id",
  as: "pharmacist_dispensed",
  constraints: false
});

Prescription.belongsTo(HospitalStaff, {
  foreignKey: "dispensed_by_id",
  as: "dispensing_pharmacist",
  constraints: false
});

// Bed Management Relationships
HospitalAdmin.hasMany(Bed, {
  foreignKey: "hospital_id",
  as: "hospital_bed_list",
  onDelete: "RESTRICT"
});

Bed.belongsTo(HospitalAdmin, {
  foreignKey: "hospital_id",
  as: "bed_hospital",
  onDelete: "RESTRICT"
});

Bed.hasMany(Admission, {
  foreignKey: "bed_id",
  as: "bed_admission_records",
  onDelete: "RESTRICT"
});

Admission.belongsTo(Bed, {
  foreignKey: "bed_id",
  as: "admission_bed",
  onDelete: "RESTRICT"
});

HospitalStaff.hasMany(Bed, {
  foreignKey: "managed_by",
  as: "managed_bed_list",
  constraints: false
});

Bed.belongsTo(HospitalStaff, {
  foreignKey: "managed_by",
  as: "bed_manager_staff",
  constraints: false
});

// Referral Relationships
HospitalStaff.hasMany(Referral, {
  foreignKey: "referring_doctor_id",
  as: "doctor_referrals",
  constraints: false
});

Referral.belongsTo(HospitalStaff, {
  foreignKey: "referring_doctor_id",
  as: "referring_doctor_staff",
  constraints: false
});

// Medication Inventory
HospitalStaff.hasMany(Medication, {
  foreignKey: "updated_by",
  as: "staff_medication_updates",
  constraints: false
});

Medication.belongsTo(HospitalStaff, {
  foreignKey: "updated_by",
  as: "updating_staff",
  constraints: false
});

// HR Scheduling Relationships
HospitalStaff.hasMany(Schedule, {
  foreignKey: "staff_id",
  as: "staff_schedules",
  onDelete: "CASCADE"
});

Schedule.belongsTo(HospitalStaff, {
  foreignKey: "staff_id",
  as: "scheduled_staff"
});

HospitalStaff.hasMany(LeaveRequest, {
  foreignKey: "staff_id",
  as: "staff_leave_requests",
  onDelete: "CASCADE"
});

LeaveRequest.belongsTo(HospitalStaff, {
  foreignKey: "staff_id",
  as: "requesting_staff"
});

HospitalStaff.hasMany(ShiftSwap, {
  foreignKey: "requesting_staff_id",
  as: "requested_shift_swaps",
  onDelete: "CASCADE"
});

HospitalStaff.hasMany(ShiftSwap, {
  foreignKey: "target_staff_id",
  as: "targeted_shift_swaps",
  onDelete: "CASCADE"
});

ShiftSwap.belongsTo(HospitalStaff, {
  foreignKey: "requesting_staff_id",
  as: "swap_requester"
});

ShiftSwap.belongsTo(HospitalStaff, {
  foreignKey: "target_staff_id",
  as: "swap_target"
});

ShiftSwap.belongsTo(Schedule, {
  foreignKey: "schedule_id",
  as: "swap_schedule"
});

// Report Relationships (Polymorphic)
Report.belongsTo(FederalAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_federal',
  scope: { sender_type: 'federal' }
});

Report.belongsTo(RegionalAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_regional',
  scope: { sender_type: 'regional' }
});

Report.belongsTo(ZoneAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_zone',
  scope: { sender_type: 'zone' }
});

Report.belongsTo(WoredaAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_woreda',
  scope: { sender_type: 'woreda' }
});

Report.belongsTo(KebeleAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_kebele',
  scope: { sender_type: 'kebele' }
});

Report.belongsTo(HospitalAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_hospital',
  scope: { sender_type: 'hospital' }
});

Report.belongsTo(HospitalStaff, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_staff',
  scope: { sender_type: 'staff' }
});

Report.belongsTo(FederalAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_federal',
  scope: { recipient_type: 'federal' }
});

Report.belongsTo(RegionalAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_regional',
  scope: { recipient_type: 'regional' }
});

Report.belongsTo(ZoneAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_zone',
  scope: { recipient_type: 'zone' }
});

Report.belongsTo(WoredaAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_woreda',
  scope: { recipient_type: 'woreda' }
});

Report.belongsTo(KebeleAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_kebele',
  scope: { recipient_type: 'kebele' }
});

Report.belongsTo(HospitalAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_hospital',
  scope: { recipient_type: 'hospital' }
});

Report.belongsTo(HospitalStaff, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_staff',
  scope: { recipient_type: 'staff' }
});

Report.belongsTo(Report, {
  foreignKey: 'parent_report_id',
  as: 'parent_report'
});

Report.hasMany(Report, {
  foreignKey: 'parent_report_id',
  as: 'report_replies'
});

// Notification Relationships
Notification.belongsTo(Report, {
  foreignKey: 'reference_id',
  as: 'notification_report',
  constraints: false
});

Notification.belongsTo(FederalAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_federal',
  scope: { recipient_type: 'federal' }
});

Notification.belongsTo(RegionalAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_regional',
  scope: { recipient_type: 'regional' }
});

Notification.belongsTo(ZoneAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_zone',
  scope: { recipient_type: 'zone' }
});

Notification.belongsTo(WoredaAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_woreda',
  scope: { recipient_type: 'woreda' }
});

Notification.belongsTo(KebeleAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_kebele',
  scope: { recipient_type: 'kebele' }
});

Notification.belongsTo(HospitalAdmin, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_hospital',
  scope: { recipient_type: 'hospital' }
});

Notification.belongsTo(HospitalStaff, {
  foreignKey: 'recipient_id',
  constraints: false,
  as: 'recipient_details_staff',
  scope: { recipient_type: 'staff' }
});

Notification.belongsTo(FederalAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_federal',
  scope: { sender_type: 'federal' }
});

Notification.belongsTo(RegionalAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_regional',
  scope: { sender_type: 'regional' }
});

Notification.belongsTo(ZoneAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_zone',
  scope: { sender_type: 'zone' }
});

Notification.belongsTo(WoredaAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_woreda',
  scope: { sender_type: 'woreda' }
});

Notification.belongsTo(KebeleAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_kebele',
  scope: { sender_type: 'kebele' }
});

Notification.belongsTo(HospitalAdmin, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_hospital',
  scope: { sender_type: 'hospital' }
});

Notification.belongsTo(HospitalStaff, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'sender_details_staff',
  scope: { sender_type: 'staff' }
});

// ============================================
// SECOND: Call associate methods for models that have them
// ============================================

// Call associate for Prescription (and any other models with associate method)
if (Prescription.associate) {
  Prescription.associate({
    Patient,
    HospitalStaff,
    HospitalAdmin
  });
}

// You can add similar calls for other models if they have associate methods
// For example, if Patient has an associate method:
// if (Patient.associate) {
//   Patient.associate({ HospitalAdmin, VitalSign, Prescription, Admission, Referral, AntenatalVisit, DeliveryRecord });
// }

// ============================================
// EXPORT ALL MODELS
// ============================================

export {
  sequelize,
  Patient,
  LabRequest,
  LabResult,
  RadiologyRequest,
  RadiologyReport,
  Prescription,
  Bed,
  Admission,
  Referral,
  AntenatalVisit,
  DeliveryRecord,
  Schedule,
  LeaveRequest,
  ShiftSwap,
  FederalAdmin,
  RegionalAdmin,
  ZoneAdmin,
  WoredaAdmin,
  KebeleAdmin,
  HospitalAdmin,
  HospitalStaff,
  Medication,
  VitalSign,
  Report,
  Notification
};

export default {
  sequelize,
  Patient,
  LabRequest,
  LabResult,
  RadiologyRequest,
  RadiologyReport,
  Prescription,
  Bed,
  Admission,
  Referral,
  AntenatalVisit,
  DeliveryRecord,
  Schedule,
  LeaveRequest,
  ShiftSwap,
  FederalAdmin,
  RegionalAdmin,
  ZoneAdmin,
  WoredaAdmin,
  KebeleAdmin,
  HospitalAdmin,
  HospitalStaff,
  Medication,
  VitalSign,
  Report,
  Notification
};   