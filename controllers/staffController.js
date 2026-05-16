// backend/controllers/staffController.js
import { Op } from 'sequelize';
import Schedule from '../models/Schedule.js';
import HospitalStaff from '../models/HospitalStaff.js';
import HospitalAdmin from '../models/HospitalAdmin.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import bcrypt from 'bcryptjs';

// ==================== HELPER FUNCTIONS ====================

const formatFullName = (staff) => {
  if (!staff) return 'Unknown';
  const firstName = staff.first_name || '';
  const middleName = staff.middle_name ? ` ${staff.middle_name}` : '';
  const lastName = staff.last_name || '';
  return `${firstName}${middleName} ${lastName}`.trim();
};

const getShiftDisplayName = (shiftType) => {
  const shifts = {
    morning: { name: 'Morning', start: '08:00', end: '14:00', hours: 6, icon: '🌅' },
    afternoon: { name: 'Afternoon', start: '14:00', end: '20:00', hours: 6, icon: '☀️' },
    night: { name: 'Night', start: '20:00', end: '08:00', hours: 12, icon: '🌙' }
  };
  return shifts[shiftType] || { name: shiftType, start: '--:--', end: '--:--', hours: 0, icon: '📅' };
};

const getWeekRange = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(start.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

// ==================== STAFF SCHEDULE VIEWING ====================

// @desc    Get my upcoming schedule
// @route   GET /api/staff/my-schedule
export const getMySchedule = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;

    console.log(`📅 Fetching schedule for staff ${staffId} (${req.user.first_name} ${req.user.last_name})`);

    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.gte]: new Date() }
      },
      order: [['date', 'ASC']],
      limit: parseInt(days)
    });

    let totalHours = 0;
    const shiftsByType = { morning: 0, afternoon: 0, night: 0 };
    
    schedules.forEach(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      totalHours += shift.hours;
      shiftsByType[schedule.shift_type]++;
    });

    const processedSchedules = schedules.map(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      return {
        id: schedule.id,
        date: schedule.date,
        date_formatted: new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_icon: shift.icon,
        start_time: shift.start,
        end_time: shift.end,
        hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status
      };
    });

    res.json({
      success: true,
      staff: {
        id: req.user.id,
        full_name: formatFullName(req.user),
        department: req.user.department,
        ward: req.user.ward,
        role: req.user.role
      },
      summary: {
        total_shifts: schedules.length,
        total_hours: totalHours,
        shifts_by_type: shiftsByType,
        upcoming_shifts: schedules.length,
        next_shift: schedules.length > 0 ? {
          date: schedules[0].date,
          shift_name: getShiftDisplayName(schedules[0].shift_type).name,
          ward: schedules[0].ward,
          hours: getShiftDisplayName(schedules[0].shift_type).hours
        } : null
      },
      schedules: processedSchedules
    });
  } catch (error) {
    console.error('Error fetching my schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my weekly schedule
// @route   GET /api/staff/weekly-schedule
export const getMyWeeklySchedule = async (req, res) => {
  try {
    const { week_start } = req.query;
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;

    let startDate, endDate;
    
    if (week_start) {
      startDate = new Date(week_start);
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(startDate.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const weekRange = getWeekRange(new Date());
      startDate = weekRange.start;
      endDate = weekRange.end;
    }

    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [startDate, endDate] }
      },
      order: [['date', 'ASC']]
    });

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weeklyView = [];
    let totalHours = 0;

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const daySchedules = schedules.filter(s => new Date(s.date).toDateString() === currentDate.toDateString());
      
      let dayTotalHours = 0;
      const shifts = daySchedules.map(s => {
        const shift = getShiftDisplayName(s.shift_type);
        dayTotalHours += shift.hours;
        totalHours += shift.hours;
        return {
          id: s.id,
          shift_type: s.shift_type,
          shift_name: shift.name,
          shift_icon: shift.icon,
          start_time: shift.start,
          end_time: shift.end,
          hours: shift.hours,
          ward: s.ward,
          status: s.status
        };
      });

      weeklyView.push({
        day: daysOfWeek[i],
        date: currentDate,
        date_formatted: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        is_today: currentDate.toDateString() === new Date().toDateString(),
        shifts: shifts,
        total_hours: dayTotalHours,
        has_shifts: shifts.length > 0
      });
    }

    res.json({
      success: true,
      week_range: {
        start: startDate,
        end: endDate,
        start_formatted: startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        end_formatted: endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      },
      total_hours: totalHours,
      total_shifts: schedules.length,
      weekly_view: weeklyView,
      schedules: schedules.map(s => ({
        id: s.id,
        date: s.date,
        shift_name: getShiftDisplayName(s.shift_type).name,
        shift_icon: getShiftDisplayName(s.shift_type).icon,
        start_time: getShiftDisplayName(s.shift_type).start,
        end_time: getShiftDisplayName(s.shift_type).end,
        hours: getShiftDisplayName(s.shift_type).hours,
        ward: s.ward,
        status: s.status
      }))
    });
  } catch (error) {
    console.error('Error fetching weekly schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my today's schedule
// @route   GET /api/staff/today-schedule
export const getMyTodaySchedule = async (req, res) => {
  try {
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const schedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [today, tomorrow] }
      },
      order: [['shift_type', 'ASC']]
    });

    let currentShift = null;
    let upcomingShift = null;
    const now = new Date();
    const currentHour = now.getHours();

    schedules.forEach(schedule => {
      const shift = getShiftDisplayName(schedule.shift_type);
      const [startHour] = shift.start.split(':').map(Number);
      const [endHour] = shift.end.split(':').map(Number);
      
      const scheduleData = {
        id: schedule.id,
        shift_type: schedule.shift_type,
        shift_name: shift.name,
        shift_icon: shift.icon,
        start_time: shift.start,
        end_time: shift.end,
        hours: shift.hours,
        ward: schedule.ward,
        status: schedule.status,
        is_ongoing: currentHour >= startHour && currentHour < (endHour < startHour ? endHour + 24 : endHour),
        is_upcoming: currentHour < startHour
      };

      if (scheduleData.is_ongoing) {
        currentShift = scheduleData;
      } else if (scheduleData.is_upcoming && !upcomingShift) {
        upcomingShift = scheduleData;
      }
    });

    res.json({
      success: true,
      date: today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      has_schedule: schedules.length > 0,
      current_shift: currentShift,
      upcoming_shift: upcomingShift,
      all_shifts: schedules.map(s => {
        const shift = getShiftDisplayName(s.shift_type);
        return {
          id: s.id,
          shift_name: shift.name,
          shift_icon: shift.icon,
          start_time: shift.start,
          end_time: shift.end,
          hours: shift.hours,
          ward: s.ward,
          status: s.status
        };
      })
    });
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my schedule statistics
// @route   GET /api/staff/schedule-stats
export const getMyScheduleStats = async (req, res) => {
  try {
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeek = getWeekRange(today);
    const nextWeek = getWeekRange(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
    
    const thisWeekSchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [thisWeek.start, thisWeek.end] }
      }
    });
    
    const nextWeekSchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [nextWeek.start, nextWeek.end] }
      }
    });
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todaySchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [today, tomorrow] }
      }
    });
    
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const upcomingSchedules = await Schedule.findAll({
      where: {
        staff_id: staffId,
        hospital_id: hospitalId,
        date: { [Op.between]: [tomorrow, next7Days] }
      }
    });
    
    const calculateHours = (schedules) => {
      let hours = 0;
      schedules.forEach(s => { hours += getShiftDisplayName(s.shift_type).hours; });
      return hours;
    };
    
    res.json({
      success: true,
      stats: {
        today: {
          has_schedule: todaySchedules.length > 0,
          shift_count: todaySchedules.length,
          total_hours: calculateHours(todaySchedules)
        },
        this_week: {
          shift_count: thisWeekSchedules.length,
          total_hours: calculateHours(thisWeekSchedules),
          week_range: `${thisWeek.start.toLocaleDateString()} - ${thisWeek.end.toLocaleDateString()}`
        },
        next_week: {
          shift_count: nextWeekSchedules.length,
          total_hours: calculateHours(nextWeekSchedules),
          week_range: `${nextWeek.start.toLocaleDateString()} - ${nextWeek.end.toLocaleDateString()}`
        },
        upcoming: {
          shift_count: upcomingSchedules.length,
          total_hours: calculateHours(upcomingSchedules),
          next_shift: upcomingSchedules.length > 0 ? {
            date: upcomingSchedules[0].date,
            shift_name: getShiftDisplayName(upcomingSchedules[0].shift_type).name,
            ward: upcomingSchedules[0].ward
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my notifications
// @route   GET /api/staff/notifications
export const getMyNotifications = async (req, res) => {
  try {
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'
    };
    
    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    const unreadCount = await Notification.count({
      where: {
        recipient_id: req.user.id,
        recipient_type: 'staff',
        is_read: false
      }
    });
    
    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PROFILE (SINGLE VERSION) ====================
export const getStaffProfile = async (req, res) => {
  try {
    const staff = await HospitalStaff.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!staff) {
      return res.status(404).json({ 
        success: false, 
        message: 'Staff not found' 
      });
    }
    
    res.json({ 
      success: true, 
      staff: {
        id: staff.id,
        first_name: staff.first_name,
        middle_name: staff.middle_name,
        last_name: staff.last_name,
        email: staff.email,
        phone: staff.phone,
        gender: staff.gender,
        age: staff.age,
        department: staff.department,
        ward: staff.ward,        // ✅ CRITICAL - Ward for filtering
        role: staff.role,
        status: staff.status,
        hospital_id: staff.hospital_id,
        hospital_name: staff.hospital_name
      }
    });
  } catch (error) {
    console.error('Get staff profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORTS ====================
export const getStaffInbox = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {
      recipient_id: req.user.id,
      recipient_type: 'staff'
    };
    
    const { count, rows } = await Report.findAndCountAll({
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
      reports: rows,
      totalCount: count,
      unreadCount,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get staff inbox error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStaffOutbox = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await Report.findAndCountAll({
      where: {
        sender_id: req.user.id,
        sender_type: 'staff'
      },
      order: [['sent_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      reports: rows,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get staff outbox error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStaffReportById = async (req, res) => {
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
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    if (report.recipient_id === req.user.id && !report.is_opened) {
      await report.update({
        is_opened: true,
        opened_at: new Date(),
        opened_count: (report.opened_count || 0) + 1
      });
    }
    
    res.json({ success: true, report });
  } catch (error) {
    console.error('Get staff report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CORRECTED - Send report with all required fields
export const sendStaffReport = async (req, res) => {
  try {
    const { title, body, priority, recipient_id } = req.body;
    const sender = req.user;
    
    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and body are required' 
      });
    }
    
    const recipient = await HospitalAdmin.findByPk(recipient_id);
    
    if (!recipient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Recipient not found' 
      });
    }
    
    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({ order: [['id', 'DESC']] });
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;
    
    const report = await Report.create({
      report_number,
      title,
      body,
      priority: priority || 'medium',
      status: 'sent',
      
      // ✅ Sender info - COMPLETE
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      sender_department: sender.department,
      sender_ward: sender.ward,           // ✅ CRITICAL for filtering
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      
      // ✅ Recipient info - COMPLETE
      recipient_id: recipient.id,
      recipient_type: 'hospital',
      recipient_first_name: recipient.first_name,
      recipient_middle_name: recipient.middle_name,
      recipient_last_name: recipient.last_name,
      recipient_full_name: formatFullName(recipient),
      recipient_hospital: recipient.hospital_name,
      recipient_hospital_id: recipient.id,
      
      sent_at: new Date(),
      last_activity_at: new Date()
    });
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      const adminRoom = `hospital_${recipient.id}_admin`;
      io.to(adminRoom).emit('new_report_from_staff', {
        report_id: report.id,
        report_number: report.report_number,
        title: report.title,
        priority: report.priority,
        sender_name: formatFullName(sender),
        sender_department: sender.department,
        sender_ward: sender.ward,
        sent_at: report.sent_at
      });
    }
    
    res.status(201).json({ success: true, report, message: 'Report sent successfully' });
  } catch (error) {
    console.error('Send staff report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CORRECTED - Reply to report with all required fields
export const replyToStaffReport = async (req, res) => {
  try {
    const { body } = req.body;
    
    const parentReport = await Report.findByPk(req.params.id);
    
    if (!parentReport) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    if (!body) {
      return res.status(400).json({ success: false, message: 'Reply body is required' });
    }
    
    const sender = req.user;
    
    const date = new Date();
    const year = date.getFullYear();
    const lastReport = await Report.findOne({ order: [['id', 'DESC']] });
    let nextNumber = 1;
    if (lastReport && lastReport.report_number) {
      const match = lastReport.report_number.match(/RPT-\d+-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const report_number = `RPT-${year}-${String(nextNumber).padStart(4, '0')}`;
    
    const reply = await Report.create({
      report_number,
      title: `Re: ${parentReport.title}`,
      body,
      priority: parentReport.priority,
      status: 'sent',
      
      // ✅ Sender info - COMPLETE
      sender_id: sender.id,
      sender_type: 'staff',
      sender_first_name: sender.first_name,
      sender_middle_name: sender.middle_name,
      sender_last_name: sender.last_name,
      sender_full_name: formatFullName(sender),
      sender_department: sender.department,
      sender_ward: sender.ward,           // ✅ CRITICAL for filtering
      sender_hospital: sender.hospital_name,
      sender_hospital_id: sender.hospital_id,
      
      // ✅ Recipient info - COMPLETE
      recipient_id: parentReport.sender_id,
      recipient_type: parentReport.sender_type,
      recipient_first_name: parentReport.sender_first_name,
      recipient_middle_name: parentReport.sender_middle_name,
      recipient_last_name: parentReport.sender_last_name,
      recipient_full_name: parentReport.sender_full_name,
      recipient_hospital: parentReport.sender_hospital,
      recipient_hospital_id: parentReport.sender_hospital_id,
      
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
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      let recipientRoom = '';
      if (parentReport.sender_type === 'hospital') {
        recipientRoom = `hospital_${parentReport.sender_hospital_id}_admin`;
      } else if (parentReport.sender_type === 'staff') {
        recipientRoom = `hospital_${parentReport.sender_hospital_id}_doctor_${parentReport.sender_id}`;
      }
      
      io.to(recipientRoom).emit('report_reply_from_staff', {
        report_id: reply.id,
        parent_report_id: parentReport.id,
        report_number: reply.report_number,
        title: reply.title,
        priority: reply.priority,
        sender_name: formatFullName(sender),
        sender_department: sender.department,
        sender_ward: sender.ward,
        sent_at: reply.sent_at,
        body_preview: body.substring(0, 100),
        body: body,
        is_reply: true
      });
    }
    
    res.json({ success: true, reply, message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Reply to staff report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== NOTIFICATIONS ====================
export const markStaffNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        recipient_id: req.user.id,
        recipient_type: 'staff'
      }
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    await notification.update({ is_read: true, read_at: new Date() });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark staff notification read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};