// backend/controllers/hrController.js
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import HospitalStaff from '../models/HospitalStaff.js';
import Schedule from '../models/Schedule.js';
import LeaveRequest from '../models/LeaveRequest.js';
import ShiftSwap from '../models/ShiftSwap.js';
import Notification from '../models/Notification.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Report from '../models/Report.js';
import bcrypt from 'bcryptjs';

// ==================== HELPER FUNCTIONS ====================

// Format staff full name with middle name
const formatFullName = (staff) => {
  if (!staff) return 'Unknown';
  const firstName = staff.first_name || '';
  const middleName = staff.middle_name ? ` ${staff.middle_name}` : '';
  const lastName = staff.last_name || '';
  return `${firstName}${middleName} ${lastName}`.trim();
};

// Get shift display name
const getShiftDisplayName = (shiftType) => {
  const shifts = {
    morning: { name: 'Morning', start: '08:00', end: '14:00', hours: 6 },
    afternoon: { name: 'Afternoon', start: '14:00', end: '20:00', hours: 6 },
    night: { name: 'Night', start: '20:00', end: '08:00', hours: 12 }
  };
  return shifts[shiftType] || { name: shiftType, start: '--:--', end: '--:--', hours: 0 };
};

// Send notification to a single staff member
const sendStaffNotification = async (staffId, hospitalId, title, message, type, priority = 'medium', data = {}) => {
  try {
    const notification = await Notification.create({
      recipient_id: staffId,
      recipient_type: 'staff',
      hospital_id: hospitalId,
      title,
      message,
      type,
      priority,
      data,
      is_read: false
    });
    console.log(`✅ Notification sent to staff ${staffId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

// Format weekly schedule message for individual staff
const formatWeeklyScheduleMessage = (staff, schedules, weekStartDate, weekEndDate, totalHours) => {
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const scheduleByDay = {};
  
  schedules.forEach(schedule => {
    const date = new Date(schedule.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    if (!scheduleByDay[dayName]) scheduleByDay[dayName] = [];
    scheduleByDay[dayName].push(schedule);
  });
  
  let scheduleText = '';
  for (const day of daysOrder) {
    if (scheduleByDay[day] && scheduleByDay[day].length > 0) {
      scheduleByDay[day].forEach(schedule => {
        const shift = getShiftDisplayName(schedule.shift_type);
        scheduleText += `\n📅 ${day}, ${new Date(schedule.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${shift.name} Shift (${shift.start}-${shift.end}) - ${schedule.ward} Ward`;
      });
    } else {
      scheduleText += `\n📅 ${day}: OFF`;
    }
  }
  
  const weekStartFormatted = new Date(weekStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const weekEndFormatted = new Date(weekEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  return {
    title: `📅 Your Weekly Schedule - ${weekStartFormatted} to ${weekEndFormatted}`,
    message: `Dear ${formatFullName(staff)},

Your schedule for week of ${weekStartFormatted} has been published:

${scheduleText}

📊 Total hours this week: ${totalHours} hours

Please review your schedule and contact HR if you have any conflicts.

Best regards,
HR Department`
  };
};

// ==================== STAFF MANAGEMENT ====================

// @desc    Get all staff
// @route   GET /api/hr/staff
export const getStaff = async (req, res) => {
  try {
    const { hospital_id, ward, department, status } = req.query;

    const whereClause = { hospital_id };

    if (ward) whereClause.ward = ward;
    if (department) whereClause.department = department;
    if (status) whereClause.status = status;

    const staff = await HospitalStaff.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['first_name', 'ASC']]
    });

    const staffWithFullName = staff.map(s => ({
      ...s.toJSON(),
      full_name: formatFullName(s)
    }));

    res.json({
      success: true,
      staff: staffWithFullName
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add new staff
// @route   POST /api/hr/staff
export const addStaff = async (req, res) => {
  try {
    const { 
      hospital_id, first_name, middle_name, last_name, email, phone, 
      department, ward, role, max_hours_per_week, skills 
    } = req.body;

    const existingStaff = await HospitalStaff.findOne({ 
      where: { email, hospital_id } 
    });
    
    if (existingStaff) {
      return res.status(400).json({ 
        success: false, 
        message: 'Staff with this email already exists' 
      });
    }

    const defaultPassword = `Staff@${Math.floor(Math.random() * 10000)}`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    const staff = await HospitalStaff.create({
      hospital_id,
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      department,
      ward,
      role: role || department,
      max_hours_per_week: max_hours_per_week || 40,
      skills: skills || [],
      status: 'active',
      password: hashedPassword
    });

    // Send welcome notification to new staff
    await sendStaffNotification(
      staff.id,
      hospital_id,
      `Welcome to the Hospital`,
      `Dear ${formatFullName(staff)},

Welcome to the team! You have been added as a ${role || department} in the ${ward} Ward.

Your login email is: ${email}
Temporary password: ${defaultPassword}

Please change your password after first login.

Best regards,
HR Department`,
      'staff_added',
      'high',
      { password: defaultPassword }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_hr`).emit('staff_updated', {
        action: 'added',
        staff: {
          id: staff.id,
          first_name: staff.first_name,
          middle_name: staff.middle_name,
          last_name: staff.last_name,
          full_name: formatFullName(staff),
          email: staff.email
        }
      });
      
      io.to(`staff_${staff.id}`).emit('welcome_notification', {
        message: `Welcome ${formatFullName(staff)}! You have been added to the team.`
      });
    }

    res.json({
      success: true,
      message: 'Staff added successfully',
      staff: { ...staff.toJSON(), password: defaultPassword, full_name: formatFullName(staff) }
    });
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update staff
// @route   PUT /api/hr/staff/:id
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const staff = await HospitalStaff.findByPk(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    await staff.update(updates);

    await sendStaffNotification(
      staff.id,
      staff.hospital_id,
      'Profile Updated',
      `Dear ${formatFullName(staff)},

Your profile information has been updated by HR.

If you did not request this change, please contact HR immediately.

Best regards,
HR Department`,
      'profile_updated',
      'medium'
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${staff.hospital_id}_hr`).emit('staff_updated', {
        action: 'updated',
        staff: { id: staff.id, full_name: formatFullName(staff) }
      });
      io.to(`staff_${staff.id}`).emit('profile_updated', { message: 'Your profile has been updated' });
    }

    res.json({
      success: true,
      message: 'Staff updated successfully',
      staff: { ...staff.toJSON(), full_name: formatFullName(staff) }
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete staff (soft delete)
// @route   DELETE /api/hr/staff/:id
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await HospitalStaff.findByPk(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    await staff.update({ status: 'inactive' });

    await sendStaffNotification(
      staff.id,
      staff.hospital_id,
      'Account Deactivated',
      `Dear ${formatFullName(staff)},

Your account has been deactivated by HR.

Please contact HR for more information.

Best regards,
HR Department`,
      'account_deactivated',
      'high'
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${staff.hospital_id}_hr`).emit('staff_updated', {
        action: 'deleted',
        staff: { id: staff.id, full_name: formatFullName(staff) }
      });
      io.to(`staff_${staff.id}`).emit('account_deactivated', { message: 'Your account has been deactivated' });
    }

    res.json({
      success: true,
      message: 'Staff deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SCHEDULE MANAGEMENT ====================

// @desc    Get all schedules
// @route   GET /api/hr/schedules
export const getSchedules = async (req, res) => {
  try {
    const { hospital_id, start_date, end_date, staff_id, ward } = req.query;

    const whereClause = { hospital_id };

    if (start_date && end_date) {
      whereClause.date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else {
      const today = new Date();
      const sixtyDaysLater = new Date();
      sixtyDaysLater.setDate(today.getDate() + 60);
      whereClause.date = {
        [Op.between]: [today, sixtyDaysLater]
      };
    }
    
    if (staff_id) whereClause.staff_id = staff_id;
    if (ward) whereClause.ward = ward;

    const schedules = await Schedule.findAll({
      where: whereClause,
      include: [{
        model: HospitalStaff,
        as: 'scheduled_staff',
        attributes: ['first_name', 'middle_name', 'last_name', 'email', 'role', 'department', 'ward']
      }],
      order: [['date', 'ASC']]
    });

    const processedSchedules = schedules.map(schedule => {
      const staffData = schedule.scheduled_staff;
      return {
        id: schedule.id,
        staff_id: schedule.staff_id,
        staff_name: staffData ? formatFullName(staffData) : 'Unknown',
        staff_first_name: staffData?.first_name,
        staff_middle_name: staffData?.middle_name,
        staff_last_name: staffData?.last_name,
        staff_role: staffData ? staffData.role : 'Unknown',
        staff_ward: staffData ? staffData.ward : schedule.ward,
        date: schedule.date,
        shift_type: schedule.shift_type,
        ward: schedule.ward,
        status: schedule.status,
        hospital_id: schedule.hospital_id,
        created_at: schedule.createdAt,
        updated_at: schedule.updatedAt
      };
    });

    res.json({
      success: true,
      schedules: processedSchedules
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get schedule by ID
// @route   GET /api/hr/schedules/:id
export const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await Schedule.findByPk(id, {
      include: [{
        model: HospitalStaff,
        as: 'scheduled_staff',
        attributes: ['first_name', 'middle_name', 'last_name', 'email', 'role']
      }]
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const staffData = schedule.scheduled_staff;
    res.json({
      success: true,
      schedule: {
        ...schedule.toJSON(),
        staff_name: staffData ? formatFullName(staffData) : 'Unknown',
        staff_full_name: staffData ? formatFullName(staffData) : 'Unknown'
      }
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create schedule
// @route   POST /api/hr/schedules
export const createSchedule = async (req, res) => {
  try {
    const { staff_id, date, shift_type, ward, hospital_id } = req.body;

    const existingSchedule = await Schedule.findOne({
      where: {
        staff_id,
        date: new Date(date),
        hospital_id
      }
    });

    if (existingSchedule) {
      return res.status(400).json({ success: false, message: 'Staff already scheduled for this date' });
    }

    const staff = await HospitalStaff.findByPk(staff_id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const schedule = await Schedule.create({
      staff_id,
      date,
      shift_type,
      ward,
      hospital_id,
      created_by: req.user.id,
      status: 'scheduled'
    });

    const shift = getShiftDisplayName(shift_type);
    const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    // Send notification to the scheduled staff member
    await sendStaffNotification(
      staff_id,
      hospital_id,
      `New Shift Assigned - ${formattedDate}`,
      `Dear ${formatFullName(staff)},

You have been scheduled for a ${shift.name} Shift on ${formattedDate}.

⏰ Time: ${shift.start} - ${shift.end}
📍 Location: ${ward} Ward
⏱️ Duration: ${shift.hours} hours

Please check your schedule for details.

Best regards,
HR Department`,
      'new_schedule',
      'high',
      { schedule_id: schedule.id, date, shift_type, ward }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_hr`).emit('schedule_updated', {
        date,
        ward,
        action: 'created',
        staff_name: formatFullName(staff),
        shift: shift.name
      });
      
      io.to(`staff_${staff_id}`).emit('new_schedule_assigned', {
        schedule_id: schedule.id,
        date: formattedDate,
        shift: shift.name,
        shift_time: `${shift.start} - ${shift.end}`,
        ward: ward,
        hours: shift.hours,
        staff_name: formatFullName(staff)
      });
    }

    res.json({
      success: true,
      message: 'Schedule created successfully',
      schedule: {
        ...schedule.toJSON(),
        staff_name: formatFullName(staff)
      }
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update schedule
// @route   PUT /api/hr/schedules/:id
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { shift_type, status } = req.body;

    const schedule = await Schedule.findByPk(id, {
      include: [{
        model: HospitalStaff,
        as: 'scheduled_staff',
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'hospital_id']
      }]
    });
    
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const oldShift = getShiftDisplayName(schedule.shift_type);
    const newShift = getShiftDisplayName(shift_type || schedule.shift_type);
    const staff = schedule.scheduled_staff;
    const formattedDate = new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    await schedule.update({
      shift_type: shift_type || schedule.shift_type,
      status: status || schedule.status,
      updated_by: req.user.id
    });

    let notificationMessage = '';
    if (shift_type && shift_type !== schedule.shift_type) {
      notificationMessage = `Your shift on ${formattedDate} has been changed from ${oldShift.name} to ${newShift.name}.`;
    } else if (status && status !== schedule.status) {
      notificationMessage = `Your shift on ${formattedDate} has been ${status}.`;
    }
    
    if (notificationMessage && staff) {
      await sendStaffNotification(
        staff.id,
        staff.hospital_id,
        `Schedule Update - ${formattedDate}`,
        `Dear ${formatFullName(staff)},

${notificationMessage}

⏰ Time: ${newShift.start} - ${newShift.end}
📍 Location: ${schedule.ward} Ward
⏱️ Duration: ${newShift.hours} hours

Best regards,
HR Department`,
        'schedule_updated',
        'medium',
        { schedule_id: schedule.id }
      );
    }

    const io = req.app.get('io');
    if (io && staff) {
      io.to(`hospital_${schedule.hospital_id}_hr`).emit('schedule_updated', {
        date: schedule.date,
        ward: schedule.ward,
        action: 'updated',
        staff_name: formatFullName(staff)
      });
      
      io.to(`staff_${staff.id}`).emit('schedule_updated_notification', {
        schedule_id: schedule.id,
        date: formattedDate,
        shift: newShift.name,
        shift_time: `${newShift.start} - ${newShift.end}`,
        ward: schedule.ward,
        status: status || schedule.status
      });
    }

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      schedule
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete schedule
// @route   DELETE /api/hr/schedules/:id
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await Schedule.findByPk(id, {
      include: [{
        model: HospitalStaff,
        as: 'scheduled_staff',
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'hospital_id']
      }]
    });
    
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const staff = schedule.scheduled_staff;
    const shift = getShiftDisplayName(schedule.shift_type);
    const formattedDate = new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    await schedule.destroy();

    if (staff) {
      await sendStaffNotification(
        staff.id,
        staff.hospital_id,
        `Schedule Cancelled - ${formattedDate}`,
        `Dear ${formatFullName(staff)},

Your ${shift.name} Shift on ${formattedDate} has been cancelled.

Please contact HR if you have any questions.

Best regards,
HR Department`,
        'schedule_cancelled',
        'high',
        { schedule_id: id }
      );
    }

    const io = req.app.get('io');
    if (io && staff) {
      io.to(`hospital_${schedule.hospital_id}_hr`).emit('schedule_updated', {
        date: schedule.date,
        ward: schedule.ward,
        action: 'deleted',
        staff_name: staff ? formatFullName(staff) : 'Unknown'
      });
      
      io.to(`staff_${staff.id}`).emit('schedule_cancelled', {
        schedule_id: id,
        date: formattedDate,
        shift: shift.name,
        ward: schedule.ward
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Auto generate schedule for all staff and send notifications
// @route   POST /api/hr/schedule/auto-generate
// @desc    Auto generate schedule for all staff and send notifications
// @route   POST /api/hr/schedule/auto-generate
export const autoGenerateSchedule = async (req, res) => {
  try {
    const { hospital_id, start_date, end_date, ward } = req.body;

    const start = new Date(start_date);
    const end = new Date(end_date);
    
    // Get start of week (Monday)
    const startOfWeek = new Date(start);
    const dayOfWeek = startOfWeek.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // ========== FIX 1: Delete existing schedules for this week FIRST ==========
    const deletedCount = await Schedule.destroy({
      where: {
        hospital_id: hospital_id,
        date: {
          [Op.between]: [startOfWeek, endOfWeek]
        }
      }
    });
    console.log(`🗑️ Deleted ${deletedCount} existing schedules for week ${startOfWeek.toISOString().split('T')[0]} to ${endOfWeek.toISOString().split('T')[0]}`);

    // Get all active staff
    const staffList = await HospitalStaff.findAll({
      where: {
        hospital_id,
        status: 'active'
      }
    });

    console.log(`📋 Found ${staffList.length} staff members for scheduling`);

    if (staffList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No staff available for scheduling' 
      });
    }

    // Get leave requests
    const leaveRequests = await LeaveRequest.findAll({
      where: {
        hospital_id,
        status: 'approved',
        start_date: { [Op.lte]: end },
        end_date: { [Op.gte]: start }
      }
    });

    const leaveDates = {};
    leaveRequests.forEach(request => {
      const startDate = new Date(request.start_date);
      const endDate = new Date(request.end_date);
      const current = new Date(startDate);
      while (current <= endDate) {
        if (!leaveDates[request.staff_id]) leaveDates[request.staff_id] = [];
        leaveDates[request.staff_id].push(new Date(current).toDateString());
        current.setDate(current.getDate() + 1);
      }
    });

    const shifts = ['morning', 'afternoon', 'night'];
    const createdSchedules = [];
    const staffSchedulesMap = {};

    // Initialize staff schedule tracking
    staffList.forEach(staff => {
      staffSchedulesMap[staff.id] = [];
    });

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // ========== FIX 2: Simplified rotation algorithm ==========
    // This ensures EVERY staff member gets schedules
    for (let i = 0; i <= days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      if (currentDate > end) continue;

      // Morning shift - assign to staff based on day index
      const morningStaffIndex = i % staffList.length;
      const morningStaff = staffList[morningStaffIndex];
      
      // Afternoon shift - assign to different staff (offset by +3)
      const afternoonStaffIndex = (i + 3) % staffList.length;
      const afternoonStaff = staffList[afternoonStaffIndex];
      
      // Night shift - assign to different staff (offset by +6)
      const nightStaffIndex = (i + 6) % staffList.length;
      const nightStaff = staffList[nightStaffIndex];

      // Check leave for morning shift
      if (!leaveDates[morningStaff.id]?.includes(currentDate.toDateString())) {
        const morningSchedule = await Schedule.create({
          staff_id: morningStaff.id,
          date: currentDate,
          shift_type: 'morning',
          ward: morningStaff.ward || 'OPD',
          hospital_id: hospital_id,
          status: 'scheduled',
          created_by: req.user?.id || null
        });
        createdSchedules.push(morningSchedule);
        staffSchedulesMap[morningStaff.id].push(morningSchedule);
        console.log(`✅ Created morning shift for ${morningStaff.first_name} ${morningStaff.last_name} on ${currentDate.toISOString().split('T')[0]}`);
      }

      // Check leave for afternoon shift
      if (!leaveDates[afternoonStaff.id]?.includes(currentDate.toDateString())) {
        const afternoonSchedule = await Schedule.create({
          staff_id: afternoonStaff.id,
          date: currentDate,
          shift_type: 'afternoon',
          ward: afternoonStaff.ward || 'OPD',
          hospital_id: hospital_id,
          status: 'scheduled',
          created_by: req.user?.id || null
        });
        createdSchedules.push(afternoonSchedule);
        staffSchedulesMap[afternoonStaff.id].push(afternoonSchedule);
        console.log(`✅ Created afternoon shift for ${afternoonStaff.first_name} ${afternoonStaff.last_name} on ${currentDate.toISOString().split('T')[0]}`);
      }

      // Check leave for night shift
      if (!leaveDates[nightStaff.id]?.includes(currentDate.toDateString())) {
        const nightSchedule = await Schedule.create({
          staff_id: nightStaff.id,
          date: currentDate,
          shift_type: 'night',
          ward: nightStaff.ward || 'OPD',
          hospital_id: hospital_id,
          status: 'scheduled',
          created_by: req.user?.id || null
        });
        createdSchedules.push(nightSchedule);
        staffSchedulesMap[nightStaff.id].push(nightSchedule);
        console.log(`✅ Created night shift for ${nightStaff.first_name} ${nightStaff.last_name} on ${currentDate.toISOString().split('T')[0]}`);
      }
    }

    console.log(`✅ Created ${createdSchedules.length} new schedules`);

    // Send weekly schedule notifications to all staff
    const weekStartFormatted = startOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const weekEndFormatted = endOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const weekRange = `${weekStartFormatted} - ${weekEndFormatted}`;
    
    let staffNotifiedCount = 0;
    
    for (const staff of staffList) {
      const staffSchedules = staffSchedulesMap[staff.id] || [];
      
      if (staffSchedules.length > 0) {
        let totalHours = 0;
        staffSchedules.forEach(schedule => {
          const shift = getShiftDisplayName(schedule.shift_type);
          totalHours += shift.hours;
        });
        
        const { title, message } = formatWeeklyScheduleMessage(
          staff,
          staffSchedules,
          startOfWeek,
          endOfWeek,
          totalHours
        );
        
        // Save notification to database
        await sendStaffNotification(
          staff.id,
          hospital_id,
          title,
          message,
          'weekly_schedule',
          'high',
          { 
            week_start: startOfWeek,
            week_end: endOfWeek,
            week_range: weekRange,
            total_hours: totalHours,
            schedules_count: staffSchedules.length,
            schedules: staffSchedules.map(s => ({
              date: s.date,
              shift_type: s.shift_type,
              shift_name: getShiftDisplayName(s.shift_type).name,
              shift_time: `${getShiftDisplayName(s.shift_type).start} - ${getShiftDisplayName(s.shift_type).end}`,
              ward: s.ward,
              hours: getShiftDisplayName(s.shift_type).hours
            }))
          }
        );
        
        staffNotifiedCount++;
        
        // Emit socket event for real-time notification
        const io = req.app.get('io');
        if (io) {
          io.to(`staff_${staff.id}`).emit('weekly_schedule_ready', {
            week_start: startOfWeek,
            week_end: endOfWeek,
            week_range: weekRange,
            schedules_count: staffSchedules.length,
            total_hours: totalHours,
            schedules: staffSchedules.map(s => ({
              date: new Date(s.date).toLocaleDateString(),
              shift_name: getShiftDisplayName(s.shift_type).name,
              shift_time: `${getShiftDisplayName(s.shift_type).start} - ${getShiftDisplayName(s.shift_type).end}`,
              ward: s.ward,
              hours: getShiftDisplayName(s.shift_type).hours
            }))
          });
        }
      }
    }

    // Notify HR room
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospital_id}_hr`).emit('schedule_updated', {
        action: 'auto_generated',
        count: createdSchedules.length,
        staff_notified: staffNotifiedCount,
        week_range: weekRange
      });
    }

    res.json({
      success: true,
      message: `Generated ${createdSchedules.length} shifts and notified ${staffNotifiedCount} staff members`,
      schedules: createdSchedules,
      staff_notified: staffNotifiedCount,
      week_range: {
        start: startOfWeek,
        end: endOfWeek,
        range: weekRange
      }
    });
  } catch (error) {
    console.error('Error auto generating schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get shift types
// @route   GET /api/hr/shifts
export const getShiftTypes = async (req, res) => {
  try {
    const shifts = [
      { id: 'morning', name: 'Morning', start_time: '08:00', end_time: '14:00', hours: 6, icon: '🌅' },
      { id: 'afternoon', name: 'Afternoon', start_time: '14:00', end_time: '20:00', hours: 6, icon: '☀️' },
      { id: 'night', name: 'Night', start_time: '20:00', end_time: '08:00', hours: 12, icon: '🌙' }
    ];

    res.json({
      success: true,
      shifts
    });
  } catch (error) {
    console.error('Error fetching shift types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LEAVE MANAGEMENT ====================

// @desc    Get leave requests
// @route   GET /api/hr/leave-requests
export const getLeaveRequests = async (req, res) => {
  try {
    const { hospital_id, status, staff_id } = req.query;

    const whereClause = { hospital_id };
    if (status) whereClause.status = status;
    if (staff_id) whereClause.staff_id = staff_id;

    const requests = await LeaveRequest.findAll({
      where: whereClause,
      include: [{
        model: HospitalStaff,
        as: 'requesting_staff',
        attributes: ['first_name', 'middle_name', 'last_name', 'email', 'role', 'ward']
      }],
      order: [['created_at', 'DESC']]
    });

    const processedRequests = requests.map(request => ({
      ...request.toJSON(),
      staff_name: request.requesting_staff ? formatFullName(request.requesting_staff) : 'Unknown',
      staff_full_name: request.requesting_staff ? formatFullName(request.requesting_staff) : 'Unknown'
    }));

    res.json({
      success: true,
      requests: processedRequests
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create leave request
// @route   POST /api/hr/leave-requests
export const createLeaveRequest = async (req, res) => {
  try {
    const { staff_id, start_date, end_date, reason, hospital_id } = req.body;

    const staff = await HospitalStaff.findByPk(staff_id);
    
    const request = await LeaveRequest.create({
      staff_id,
      start_date,
      end_date,
      reason,
      hospital_id,
      status: 'pending',
      created_by: req.user.id
    });

    // Notify HR about new leave request
    const hrStaff = await HospitalStaff.findAll({
      where: {
        hospital_id,
        department: 'Human_Resource',
        status: 'active'
      }
    });
    
    for (const hr of hrStaff) {
      await sendStaffNotification(
        hr.id,
        hospital_id,
        `New Leave Request - ${formatFullName(staff)}`,
        `Dear ${formatFullName(hr)},

${formatFullName(staff)} has submitted a leave request from ${new Date(start_date).toLocaleDateString()} to ${new Date(end_date).toLocaleDateString()}.

Reason: ${reason || 'Not specified'}

Please review and approve/reject this request.

Best regards,
System`,
        'leave_request_submitted',
        'medium',
        { request_id: request.id, staff_id, start_date, end_date }
      );
    }

    res.json({
      success: true,
      message: 'Leave request submitted successfully',
      request
    });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update leave request
// @route   PUT /api/hr/leave-request/:id
export const updateLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await LeaveRequest.findByPk(id, {
      include: [{
        model: HospitalStaff,
        as: 'requesting_staff',
        attributes: ['id', 'first_name', 'middle_name', 'last_name', 'hospital_id', 'email']
      }]
    });
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const staff = request.requesting_staff;
    const startDateFormatted = new Date(request.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const endDateFormatted = new Date(request.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    await request.update({
      status,
      approved_by: req.user.id,
      approved_at: new Date()
    });

    let notificationTitle = '';
    let notificationMessage = '';
    
    if (status === 'approved') {
      notificationTitle = `Leave Request Approved - ${startDateFormatted}`;
      notificationMessage = `Dear ${formatFullName(staff)},

Your leave request from ${startDateFormatted} to ${endDateFormatted} has been APPROVED.

Enjoy your time off! Please coordinate with your team for coverage.

Best regards,
HR Department`;
      
      // Remove scheduled shifts during leave period
      await Schedule.destroy({
        where: {
          staff_id: staff.id,
          date: {
            [Op.between]: [request.start_date, request.end_date]
          }
        }
      });
    } else if (status === 'rejected') {
      notificationTitle = `Leave Request Rejected - ${startDateFormatted}`;
      notificationMessage = `Dear ${formatFullName(staff)},

We regret to inform you that your leave request from ${startDateFormatted} to ${endDateFormatted} has been REJECTED.

Please contact HR for more information.

Best regards,
HR Department`;
    }
    
    if (staff && notificationTitle && notificationMessage) {
      await sendStaffNotification(
        staff.id,
        staff.hospital_id,
        notificationTitle,
        notificationMessage,
        `leave_${status}`,
        status === 'approved' ? 'high' : 'medium',
        { request_id: id, status }
      );
    }

    const io = req.app.get('io');
    if (io && staff) {
      io.to(`hospital_${request.hospital_id}_hr`).emit('leave_request_updated', {
        request_id: id,
        status,
        staff_name: formatFullName(staff)
      });
      
      io.to(`staff_${staff.id}`).emit('leave_request_decision', {
        request_id: id,
        status,
        start_date: request.start_date,
        end_date: request.end_date,
        message: notificationMessage
      });
    }

    res.json({
      success: true,
      message: `Leave request ${status}`,
      request
    });
  } catch (error) {
    console.error('Error updating leave request:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STATISTICS ====================

// @desc    Get HR statistics
// @route   GET /api/hr/stats
export const getStats = async (req, res) => {
  try {
    const { hospital_id } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalStaff = await HospitalStaff.count({
      where: { hospital_id, status: 'active' }
    });

    let onDuty = 0;
    try {
      onDuty = await Schedule.count({
        where: {
          hospital_id,
          date: {
            [Op.between]: [today, tomorrow]
          }
        }
      });
    } catch (err) {
      console.error('Error counting on duty:', err);
    }

    let onLeave = 0;
    try {
      onLeave = await LeaveRequest.count({
        where: {
          hospital_id,
          status: 'approved',
          start_date: { [Op.lte]: today },
          end_date: { [Op.gte]: today }
        }
      });
    } catch (err) {
      console.error('Error counting on leave:', err);
    }

    let shiftsToday = 0;
    try {
      shiftsToday = await Schedule.count({
        where: {
          hospital_id,
          date: {
            [Op.between]: [today, tomorrow]
          }
        }
      });
    } catch (err) {
      console.error('Error counting shifts today:', err);
    }

    let pendingRequests = 0;
    try {
      pendingRequests = await LeaveRequest.count({
        where: { hospital_id, status: 'pending' }
      });
    } catch (err) {
      console.error('Error counting pending requests:', err);
    }

    let staffByDepartment = [];
    try {
      staffByDepartment = await HospitalStaff.findAll({
        where: { hospital_id, status: 'active' },
        attributes: [
          'department',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['department']
      });
    } catch (err) {
      console.error('Error counting staff by department:', err);
    }

    let upcomingShifts = [];
    try {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      upcomingShifts = await Schedule.findAll({
        where: {
          hospital_id,
          date: {
            [Op.between]: [today, nextWeek]
          }
        },
        include: [{
          model: HospitalStaff,
          as: 'scheduled_staff',
          attributes: ['first_name', 'middle_name', 'last_name']
        }],
        limit: 10,
        order: [['date', 'ASC']]
      });
    } catch (err) {
      console.error('Error fetching upcoming shifts:', err);
    }

    const processedUpcomingShifts = upcomingShifts.map(s => ({
      date: s.date,
      staff_name: s.scheduled_staff ? formatFullName(s.scheduled_staff) : 'Unknown',
      ward: s.ward,
      shift: s.shift_type
    }));

    res.json({
      success: true,
      stats: {
        totalStaff,
        onDuty,
        onLeave,
        shiftsToday,
        pendingRequests,
        staffByDepartment: staffByDepartment.map(d => ({
          department: d.department,
          count: parseInt(d.dataValues.count)
        })),
        upcomingShifts: processedUpcomingShifts
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.json({
      success: true,
      stats: {
        totalStaff: 0,
        onDuty: 0,
        onLeave: 0,
        shiftsToday: 0,
        pendingRequests: 0,
        staffByDepartment: [],
        upcomingShifts: []
      }
    });
  }
};

// ==================== PROFILE MANAGEMENT ====================

// @desc    Get HR profile
// @route   GET /api/hr/profile
export const getHRProfile = async (req, res) => {
  try {
    const staff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: "Staff not found" 
      });
    }
    
    res.json({ 
      success: true, 
      staff: {
        ...staff.toJSON(),
        full_name: formatFullName(staff)
      }
    });
  } catch (error) {
    console.error("Get HR profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Update HR profile
// @route   PUT /api/hr/profile
export const updateHRProfile = async (req, res) => {
  try {
    const { first_name, middle_name, last_name, gender, age, phone } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: "Staff not found" 
      });
    }
    
    await staff.update({
      first_name: first_name || staff.first_name,
      middle_name: middle_name !== undefined ? middle_name : staff.middle_name,
      last_name: last_name || staff.last_name,
      gender: gender || staff.gender,
      age: age || staff.age,
      phone: phone !== undefined ? phone : staff.phone
    });
    
    const updatedStaff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json({ 
      success: true, 
      staff: updatedStaff,
      message: "Profile updated successfully" 
    });
  } catch (error) {
    console.error("Update HR profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Change HR password
// @route   PUT /api/hr/change-password
export const changeHRPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const staff = await HospitalStaff.findByPk(req.user.id);
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: "Staff not found" 
      });
    }
    
    const isMatch = await bcrypt.compare(current_password, staff.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await staff.update({ password: hashedPassword });
    
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

// ==================== REPORT MANAGEMENT ====================

// @desc    Get HR reports inbox
// @route   GET /api/hr/reports/inbox
export const getHRReportsInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'
    };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } },
        { sender_full_name: { [Op.like]: `%${search}%` } }
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
    console.error("Get HR reports inbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get HR reports outbox
// @route   GET /api/hr/reports/outbox
export const getHRReportsOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      sender_id: req.user.id,
      sender_type: 'staff'
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
    console.error("Get HR reports outbox error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send HR report
// @route   POST /api/hr/reports/send
export const sendHRReport = async (req, res) => {
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

    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({ order: [['id', 'DESC']], attributes: ['report_number'] });
    
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
      else nextNumber = (await Report.count()) + 1;
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

    // Process attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      attachments = req.files.map(file => ({
        name: file.originalname,
        url: `${baseUrl}/uploads/reports/${file.filename}`,
        type: file.mimetype,
        size: file.size,
        uploaded_at: new Date()
      }));
    }

    const report = await Report.create({
      report_number,
      title,
      subject: subject || title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      attachments,
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      sender_title: `HR Staff - ${sender.department || 'Human Resources'} Department`,
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
      io.to(adminRoom).emit('new_report_from_hr', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: formatFullName(sender),
        sender_department: sender.department,
        sent_at: report.sent_at
      });
    }

    res.status(201).json({ success: true, report, message: "Report sent successfully" });
  } catch (error) {
    console.error("Send HR report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reply to HR report
// @route   POST /api/hr/reports/:id/reply
export const replyToHRReport = async (req, res) => {
  try {
    const { body } = req.body;
    const parentReport = await Report.findByPk(req.params.id);

    if (!parentReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const isParticipant = (
      (parentReport.sender_id === req.user.id && parentReport.sender_type === 'staff') ||
      (parentReport.recipient_id === req.user.id && parentReport.recipient_type === 'staff')
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized to reply" });
    }

    const sender = await HospitalStaff.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
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
        recipientFullName = formatFullName(hospitalAdmin);
        recipientHospitalId = hospitalAdmin.id;
        recipientHospitalName = hospitalAdmin.hospital_name || '';
      }
    } else if (recipientType === 'staff') {
      const staffMember = await HospitalStaff.findByPk(recipientId);
      if (staffMember) {
        recipientFirstName = staffMember.first_name || '';
        recipientMiddleName = staffMember.middle_name || '';
        recipientLastName = staffMember.last_name || '';
        recipientFullName = formatFullName(staffMember);
        recipientHospitalId = staffMember.hospital_id;
        recipientHospitalName = staffMember.hospital_name || '';
      }
    }

    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({ order: [['id', 'DESC']], attributes: ['report_number'] });
    
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
      else nextNumber = (await Report.count()) + 1;
    }
    
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;

    let attachment = null;
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      attachment = {
        name: req.file.originalname,
        url: `${baseUrl}/uploads/reports/${req.file.filename}`,
        type: req.file.mimetype,
        size: req.file.size,
        uploaded_at: new Date()
      };
    }

    const attachments = attachment ? [attachment] : [];

    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      subject: parentReport.subject,
      body,
      priority: parentReport.priority,
      status: 'sent',
      attachments,
      
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      sender_title: `HR Staff - ${sender.department || 'Human Resources'} Department`,
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
      let recipientRoom = '';
      
      if (recipientType === 'hospital') {
        recipientRoom = `hospital_${recipientHospitalId}_admin`;
      } else if (recipientType === 'staff') {
        recipientRoom = `hospital_${recipientHospitalId}_staff_${recipientId}`;
      }
      
      io.to(recipientRoom).emit('report_reply_from_hr', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: formatFullName(sender),
        sender_department: sender.department,
        sent_at: reply.sent_at,
        body_preview: body.substring(0, 100),
        body: body,
        has_attachments: attachments.length > 0,
        is_reply: true
      });
    }

    res.json({ 
      success: true, 
      reply, 
      message: "Reply sent successfully" 
    });
  } catch (error) {
    console.error("HR reply to report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc    Mark HR report as read
// @route   PUT /api/hr/reports/:id/read
export const markHRReportRead = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: {
        id: req.params.id,
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

// @desc    Get hospital admins for HR
// @route   GET /api/hr/hospital-admins
export const getHospitalAdminsForHR = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findByPk(req.user.id);
    
    if (!staffMember) {
      return res.json({ success: true, admins: [], message: 'Staff not found' });
    }
    
    const hospitalId = staffMember.hospital_id;
    
    console.log(`🔍 Looking for hospital admins for hospital_id: ${hospitalId}`);
    
    // Query hospital admins by hospital_id (foreign key)
    const hospitalAdmins = await HospitalAdmin.findAll({
      where: { hospital_id: hospitalId },
      attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'hospital_name']
    });
    
    console.log(`✅ Found ${hospitalAdmins.length} hospital admins`);
    
    const formatFullName = (admin) => {
      const firstName = admin.first_name || '';
      const middleName = admin.middle_name ? ` ${admin.middle_name}` : '';
      const lastName = admin.last_name || '';
      return `${firstName}${middleName} ${lastName}`.trim();
    };
    
    const formattedAdmins = hospitalAdmins.map(admin => ({
      id: admin.id,
      full_name: formatFullName(admin),
      email: admin.email,
      hospital_name: admin.hospital_name || 'Hospital',
      hospital_id: hospitalId
    }));
    
    res.json({ success: true, admins: formattedAdmins });
  } catch (error) {
    console.error("Get hospital admins error:", error);
    res.json({ success: true, admins: [], message: error.message });
  }
};

// @desc    Get staff schedule for specific staff
// @route   GET /api/hr/staff/:staffId/schedule
export const getStaffSchedule = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { start_date, end_date, hospital_id } = req.query;

    const whereClause = {
      staff_id: staffId,
      hospital_id
    };

    if (start_date && end_date) {
      whereClause.date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else {
      const today = new Date();
      const sixtyDaysLater = new Date();
      sixtyDaysLater.setDate(today.getDate() + 60);
      whereClause.date = {
        [Op.between]: [today, sixtyDaysLater]
      };
    }

    const schedules = await Schedule.findAll({
      where: whereClause,
      include: [{
        model: HospitalStaff,
        as: 'scheduled_staff',
        attributes: ['first_name', 'middle_name', 'last_name']
      }],
      order: [['date', 'ASC']]
    });

    const processedSchedules = schedules.map(s => ({
      ...s.toJSON(),
      staff_name: s.scheduled_staff ? formatFullName(s.scheduled_staff) : 'Unknown'
    }));

    res.json({
      success: true,
      schedules: processedSchedules
    });
  } catch (error) {
    console.error('Error fetching staff schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== STAFF SCHEDULE (FOR ANY STAFF TYPE) ====================

// @desc    Get schedule for logged-in staff member (works for any department)
// @route   GET /api/hr/my-schedule
// @access  Private (any authenticated staff)
export const getMySchedule = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;

    const whereClause = {
      staff_id: staffId,
      hospital_id: hospitalId
    };

    // Default to next 30 days if no dates provided
    if (start_date && end_date) {
      whereClause.date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(today.getDate() + 30);
      whereClause.date = {
        [Op.between]: [today, thirtyDaysLater]
      };
    }

    const schedules = await Schedule.findAll({
      where: whereClause,
      order: [['date', 'ASC']]
    });

    // Calculate total hours and group by week
    let totalHours = 0;
    const schedulesByWeek = {};
    
    const processedSchedules = schedules.map(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      totalHours += shift.hours;
      
      // Get week number
      const date = new Date(schedule.date);
      const weekNum = getWeekNumber(date);
      if (!schedulesByWeek[weekNum]) {
        schedulesByWeek[weekNum] = {
          week: weekNum,
          startDate: getStartOfWeek(date),
          endDate: getEndOfWeek(date),
          schedules: [],
          totalHours: 0
        };
      }
      schedulesByWeek[weekNum].schedules.push({
        id: schedule.id,
        date: schedule.date,
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_start: shift.start,
        shift_end: shift.end,
        shift_hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status
      });
      schedulesByWeek[weekNum].totalHours += shift.hours;
      
      return {
        id: schedule.id,
        date: schedule.date,
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_start: shift.start,
        shift_end: shift.end,
        shift_hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status
      };
    });

    // Get upcoming shift (next 7 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingShifts = schedules.filter(s => {
      const scheduleDate = new Date(s.date);
      return scheduleDate >= today && scheduleDate <= nextWeek;
    }).map(s => {
      const shift = getShiftDisplayName(s.shift_type);
      return {
        id: s.id,
        date: s.date,
        shift_name: shift.name,
        shift_start: shift.start,
        shift_end: shift.end,
        ward: s.ward
      };
    });

    res.json({
      success: true,
      schedules: processedSchedules,
      schedulesByWeek: Object.values(schedulesByWeek),
      total_hours: totalHours,
      upcoming_shifts: upcomingShifts,
      total_shifts: schedules.length
    });
  } catch (error) {
    console.error('Error fetching my schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper functions (duplicate definition removed)

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getEndOfWeek = (date) => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};