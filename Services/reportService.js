import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import FederalAdmin from "../models/FederalAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import WoredaAdmin from "../models/WoredaAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import HospitalStaff from "../models/HospitalStaff.js";
import { Op } from "sequelize";

class ReportService {
  
  // ==================== SEND REPORT ====================
  static async sendReport(sender, reportData) {
    try {
      console.log("📝 ReportService.sendReport called with sender:", sender);
      console.log("📝 Report data received:", reportData);

      if (!reportData) {
        throw new Error("No report data provided");
      }

      const {
        title,
        subject,
        body,
        priority = 'medium',
        recipient_type,
        recipient_id,
        attachments = []
      } = reportData;

      if (!title || !body || !recipient_type || !recipient_id) {
        console.error("❌ Missing required fields:", { title, body, recipient_type, recipient_id });
        throw new Error("Missing required fields");
      }

      if (!sender || !sender.id || !sender.type) {
        console.error("❌ Invalid sender:", sender);
        throw new Error("Invalid sender information");
      }

      console.log(`📝 Creating report from ${sender.type} to ${recipient_type}`);

      // Get sender details based on type
      let senderDetails = null;
      let senderFullName = '';
      let senderTitle = '';
      let senderPhone = '';
      let senderRegion = '';
      let senderZone = '';
      let senderWoreda = '';
      let senderKebele = '';
      let senderHospital = '';
      let senderDepartment = '';

      switch(sender.type) {
        case 'federal':
          senderDetails = await FederalAdmin.findByPk(sender.id);
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = 'Federal Admin';
            senderPhone = senderDetails.phone;
          }
          break;
        case 'regional':
          senderDetails = await RegionalAdmin.findByPk(sender.id);
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = `Regional Admin - ${senderDetails.region_name}`;
            senderPhone = senderDetails.phone;
            senderRegion = senderDetails.region_name;
          }
          break;
        case 'zone':
          senderDetails = await ZoneAdmin.findByPk(sender.id, {
            include: [{ model: RegionalAdmin, as: 'regional_admin' }]
          });
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = `Zone Admin - ${senderDetails.zone_name}`;
            senderPhone = senderDetails.phone;
            senderZone = senderDetails.zone_name;
            senderRegion = senderDetails.regional_admin?.region_name;
          }
          break;
        case 'woreda':
          senderDetails = await WoredaAdmin.findByPk(sender.id, {
            include: [{ 
              model: ZoneAdmin, 
              as: 'zone_admin',
              include: [{ model: RegionalAdmin, as: 'regional_admin' }]
            }]
          });
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = `Woreda Admin - ${senderDetails.woreda_name}`;
            senderPhone = senderDetails.phone;
            senderWoreda = senderDetails.woreda_name;
            senderZone = senderDetails.zone_admin?.zone_name;
            senderRegion = senderDetails.zone_admin?.regional_admin?.region_name;
          }
          break;
        case 'kebele':
          senderDetails = await KebeleAdmin.findByPk(sender.id, {
            include: [{ 
              model: WoredaAdmin, 
              as: 'woreda',
              include: [{ 
                model: ZoneAdmin, 
                as: 'zone_admin',
                include: [{ model: RegionalAdmin, as: 'regional_admin' }]
              }]
            }]
          });
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = `Kebele Admin - ${senderDetails.kebele_name}`;
            senderPhone = senderDetails.phone;
            senderKebele = senderDetails.kebele_name;
            senderWoreda = senderDetails.woreda?.woreda_name;
            senderZone = senderDetails.woreda?.zone_admin?.zone_name;
            senderRegion = senderDetails.woreda?.zone_admin?.regional_admin?.region_name;
          }
          break;
        case 'hospital':
          senderDetails = await HospitalAdmin.findByPk(sender.id, {
            include: [{ 
              model: KebeleAdmin, 
              as: 'kebele_admin',
              include: [{ 
                model: WoredaAdmin, 
                as: 'woreda',
                include: [{ 
                  model: ZoneAdmin, 
                  as: 'zone_admin',
                  include: [{ model: RegionalAdmin, as: 'regional_admin' }]
                }]
              }]
            }]
          });
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = `Hospital Admin - ${senderDetails.hospital_name}`;
            senderPhone = senderDetails.phone;
            senderHospital = senderDetails.hospital_name;
            senderKebele = senderDetails.kebele_admin?.kebele_name;
            senderWoreda = senderDetails.kebele_admin?.woreda?.woreda_name;
            senderZone = senderDetails.kebele_admin?.woreda?.zone_admin?.zone_name;
            senderRegion = senderDetails.kebele_admin?.woreda?.zone_admin?.regional_admin?.region_name;
          }
          break;
        case 'staff':
          senderDetails = await HospitalStaff.findByPk(sender.id, {
            include: [{ 
              model: HospitalAdmin, 
              as: 'hospital_administrator',
              include: [{ 
                model: KebeleAdmin, 
                as: 'kebele_admin',
                include: [{ 
                  model: WoredaAdmin, 
                  as: 'woreda',
                  include: [{ 
                    model: ZoneAdmin, 
                    as: 'zone_admin',
                    include: [{ model: RegionalAdmin, as: 'regional_admin' }]
                  }]
                }]
              }]
            }]
          });
          if (senderDetails) {
            senderFullName = `${senderDetails.first_name} ${senderDetails.middle_name ? senderDetails.middle_name + ' ' : ''}${senderDetails.last_name}`.trim();
            senderTitle = `${senderDetails.department} - ${senderDetails.hospital_administrator?.hospital_name}`;
            senderPhone = senderDetails.phone;
            senderDepartment = senderDetails.department;
            senderHospital = senderDetails.hospital_administrator?.hospital_name;
            senderKebele = senderDetails.hospital_administrator?.kebele_admin?.kebele_name;
            senderWoreda = senderDetails.hospital_administrator?.kebele_admin?.woreda?.woreda_name;
            senderZone = senderDetails.hospital_administrator?.kebele_admin?.woreda?.zone_admin?.zone_name;
            senderRegion = senderDetails.hospital_administrator?.kebele_admin?.woreda?.zone_admin?.regional_admin?.region_name;
          }
          break;
      }

      if (!senderDetails) {
        throw new Error(`Sender not found with id ${sender.id}`);
      }

      // Get recipient details based on type
      let recipientDetails = null;
      let recipientFullName = '';
      let recipientTitle = '';
      let recipientPhone = '';
      let recipientRegion = '';
      let recipientZone = '';
      let recipientWoreda = '';
      let recipientKebele = '';
      let recipientHospital = '';
      let recipientDepartment = '';

      switch(recipient_type) {
        case 'federal':
          recipientDetails = await FederalAdmin.findByPk(recipient_id);
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = 'Federal Admin';
            recipientPhone = recipientDetails.phone;
          }
          break;
        case 'regional':
          recipientDetails = await RegionalAdmin.findByPk(recipient_id);
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = `Regional Admin - ${recipientDetails.region_name}`;
            recipientPhone = recipientDetails.phone;
            recipientRegion = recipientDetails.region_name;
          }
          break;
        case 'zone':
          recipientDetails = await ZoneAdmin.findByPk(recipient_id, {
            include: [{ model: RegionalAdmin, as: 'regional_admin' }]
          });
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = `Zone Admin - ${recipientDetails.zone_name}`;
            recipientPhone = recipientDetails.phone;
            recipientZone = recipientDetails.zone_name;
            recipientRegion = recipientDetails.regional_admin?.region_name;
          }
          break;
        case 'woreda':
          recipientDetails = await WoredaAdmin.findByPk(recipient_id, {
            include: [{ 
              model: ZoneAdmin, 
              as: 'zone_admin',
              include: [{ model: RegionalAdmin, as: 'regional_admin' }]
            }]
          });
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = `Woreda Admin - ${recipientDetails.woreda_name}`;
            recipientPhone = recipientDetails.phone;
            recipientWoreda = recipientDetails.woreda_name;
            recipientZone = recipientDetails.zone_admin?.zone_name;
            recipientRegion = recipientDetails.zone_admin?.regional_admin?.region_name;
          }
          break;
        case 'kebele':
          recipientDetails = await KebeleAdmin.findByPk(recipient_id, {
            include: [{ 
              model: WoredaAdmin, 
              as: 'woreda',
              include: [{ 
                model: ZoneAdmin, 
                as: 'zone_admin',
                include: [{ model: RegionalAdmin, as: 'regional_admin' }]
              }]
            }]
          });
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = `Kebele Admin - ${recipientDetails.kebele_name}`;
            recipientPhone = recipientDetails.phone;
            recipientKebele = recipientDetails.kebele_name;
            recipientWoreda = recipientDetails.woreda?.woreda_name;
            recipientZone = recipientDetails.woreda?.zone_admin?.zone_name;
            recipientRegion = recipientDetails.woreda?.zone_admin?.regional_admin?.region_name;
          }
          break;
        case 'hospital':
          recipientDetails = await HospitalAdmin.findByPk(recipient_id, {
            include: [{ 
              model: KebeleAdmin, 
              as: 'kebele_admin',
              include: [{ 
                model: WoredaAdmin, 
                as: 'woreda',
                include: [{ 
                  model: ZoneAdmin, 
                  as: 'zone_admin',
                  include: [{ model: RegionalAdmin, as: 'regional_admin' }]
                }]
              }]
            }]
          });
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = `Hospital Admin - ${recipientDetails.hospital_name}`;
            recipientPhone = recipientDetails.phone;
            recipientHospital = recipientDetails.hospital_name;
            recipientKebele = recipientDetails.kebele_admin?.kebele_name;
            recipientWoreda = recipientDetails.kebele_admin?.woreda?.woreda_name;
            recipientZone = recipientDetails.kebele_admin?.woreda?.zone_admin?.zone_name;
            recipientRegion = recipientDetails.kebele_admin?.woreda?.zone_admin?.regional_admin?.region_name;
          }
          break;
        case 'staff':
          recipientDetails = await HospitalStaff.findByPk(recipient_id, {
            include: [{ 
              model: HospitalAdmin, 
              as: 'hospital_administrator',
              include: [{ 
                model: KebeleAdmin, 
                as: 'kebele_admin',
                include: [{ 
                  model: WoredaAdmin, 
                  as: 'woreda',
                  include: [{ 
                    model: ZoneAdmin, 
                    as: 'zone_admin',
                    include: [{ model: RegionalAdmin, as: 'regional_admin' }]
                  }]
                }]
              }]
            }]
          });
          if (recipientDetails) {
            recipientFullName = `${recipientDetails.first_name} ${recipientDetails.middle_name ? recipientDetails.middle_name + ' ' : ''}${recipientDetails.last_name}`.trim();
            recipientTitle = `${recipientDetails.department}`;
            recipientPhone = recipientDetails.phone;
            recipientDepartment = recipientDetails.department;
            recipientHospital = recipientDetails.hospital_administrator?.hospital_name;
            recipientKebele = recipientDetails.hospital_administrator?.kebele_admin?.kebele_name;
            recipientWoreda = recipientDetails.hospital_administrator?.kebele_admin?.woreda?.woreda_name;
            recipientZone = recipientDetails.hospital_administrator?.kebele_admin?.woreda?.zone_admin?.zone_name;
            recipientRegion = recipientDetails.hospital_administrator?.kebele_admin?.woreda?.zone_admin?.regional_admin?.region_name;
          }
          break;
      }

      if (!recipientDetails) {
        throw new Error(`Recipient not found with id ${recipient_id}`);
      }

      // Generate report number
      const date = new Date();
      const year = date.getFullYear();
      const count = await Report.count() + 1;
      const reportNumber = `RPT-${year}-${String(count).padStart(4, '0')}`;

      // Create the report
      const report = await Report.create({
        report_number: reportNumber,
        title,
        subject,
        body,
        priority,
        status: 'sent',
        
        // Sender info
        sender_id: sender.id,
        sender_type: sender.type,
        sender_first_name: senderDetails.first_name,
        sender_middle_name: senderDetails.middle_name,
        sender_last_name: senderDetails.last_name,
        sender_full_name: senderFullName,
        sender_title: senderTitle,
        sender_phone: senderPhone,
        sender_region: senderRegion,
        sender_zone: senderZone,
        sender_woreda: senderWoreda,
        sender_kebele: senderKebele,
        sender_hospital: senderHospital,
        sender_department: senderDepartment,
        
        // Recipient info
        recipient_id: recipient_id,
        recipient_type: recipient_type,
        recipient_first_name: recipientDetails.first_name,
        recipient_middle_name: recipientDetails.middle_name,
        recipient_last_name: recipientDetails.last_name,
        recipient_full_name: recipientFullName,
        recipient_title: recipientTitle,
        recipient_phone: recipientPhone,
        recipient_region: recipientRegion,
        recipient_zone: recipientZone,
        recipient_woreda: recipientWoreda,
        recipient_kebele: recipientKebele,
        recipient_hospital: recipientHospital,
        recipient_department: recipientDepartment,
        
        attachments: attachments || [],
        sent_at: new Date(),
        delivered_at: new Date(),
        last_activity_at: new Date(),
        is_opened: false,
        opened_count: 0
      });

      console.log(`✅ Report created with ID: ${report.id}, Number: ${reportNumber}`);

      // Create notification for recipient
      const notificationData = {
        title: `New Report: ${title}`,
        message: `You have received a new ${priority} priority report from ${senderFullName}`,
        type: priority === 'urgent' ? 'urgent_alert' : 'report_sent',
        priority,
        
        sender_id: sender.id,
        sender_type: sender.type,
        sender_name: senderFullName,
        
        recipient_id: recipient_id,
        recipient_type: recipient_type,
        recipient_name: recipientFullName,
        
        related_report_id: report.id,
        related_report_number: reportNumber,
        related_report_title: title,
        
        action_url: `/reports/${report.id}`,
        action_text: 'View Report',
        
        requires_sound: priority === 'urgent',
        requires_highlight: priority === 'urgent'
      };

      await Notification.create(notificationData);
      console.log(`✅ Notification created for recipient`);

      return {
        success: true,
        report,
        message: 'Report sent successfully'
      };

    } catch (error) {
      console.error('❌ Error in ReportService.sendReport:', error);
      throw error;
    }
  }

  // ==================== GET INBOX ====================
  static async getInbox(userId, userType, filters = {}) {
    try {
      const { page = 1, limit = 10, search = '' } = filters;
      const offset = (page - 1) * limit;
      
      const whereClause = {
        recipient_id: userId,
        recipient_type: userType
      };
      
      if (search) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { body: { [Op.iLike]: `%${search}%` } },
          { sender_full_name: { [Op.iLike]: `%${search}%` } },
          { report_number: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      const totalCount = await Report.count({ where: whereClause });
      
      const reports = await Report.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      const unreadCount = await Report.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          is_opened: false
        }
      });
      
      const urgentUnreadCount = await Report.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          priority: 'urgent',
          is_opened: false
        }
      });
      
      return {
        success: true,
        reports,
        totalCount,
        unreadCount,
        urgentUnreadCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page)
      };
    } catch (error) {
      console.error('❌ Error in ReportService.getInbox:', error);
      throw error;
    }
  }

  // ==================== GET OUTBOX ====================
  static async getOutbox(userId, userType, filters = {}) {
    try {
      const { page = 1, limit = 10, search = '' } = filters;
      const offset = (page - 1) * limit;
      
      const whereClause = {
        sender_id: userId,
        sender_type: userType
      };
      
      if (search) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { body: { [Op.iLike]: `%${search}%` } },
          { recipient_full_name: { [Op.iLike]: `%${search}%` } },
          { report_number: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      const totalCount = await Report.count({ where: whereClause });
      
      const reports = await Report.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      return {
        success: true,
        reports,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page)
      };
    } catch (error) {
      console.error('❌ Error in ReportService.getOutbox:', error);
      throw error;
    }
  }

  // ==================== GET REPORT BY ID ====================
  static async getReportById(reportId, userId, userType) {
    try {
      const report = await Report.findOne({
        where: {
          id: reportId,
          [Op.or]: [
            { sender_id: userId, sender_type: userType },
            { recipient_id: userId, recipient_type: userType }
          ]
        }
      });

      if (!report) {
        throw new Error('Report not found');
      }

      // If this is the recipient and report is not opened, mark as opened
      if (report.recipient_id === userId && report.recipient_type === userType && !report.is_opened) {
        await report.update({
          is_opened: true,
          opened_at: new Date(),
          opened_count: (report.opened_count || 0) + 1,
          first_opened_at: report.first_opened_at || new Date()
        });
      }

      return {
        success: true,
        report
      };
    } catch (error) {
      console.error('❌ Error in ReportService.getReportById:', error);
      throw error;
    }
  }

  // ==================== GET STATS ====================
  static async getStats(userId, userType) {
    try {
      console.log(`📊 Getting stats for ${userType} user: ${userId}`);
      
      const inboxCount = await Report.count({
        where: {
          recipient_id: userId,
          recipient_type: userType
        }
      });

      const unreadCount = await Report.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          is_opened: false
        }
      });

      const urgentUnreadCount = await Report.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          priority: 'urgent',
          is_opened: false
        }
      });

      const outboxCount = await Report.count({
        where: {
          sender_id: userId,
          sender_type: userType
        }
      });

      return {
        success: true,
        stats: {
          inbox: inboxCount,
          unread: unreadCount,
          urgentUnread: urgentUnreadCount,
          outbox: outboxCount
        }
      };
    } catch (error) {
      console.error('❌ Error in ReportService.getStats:', error);
      throw error;
    }
  }

  // ==================== REPLY TO REPORT ====================
  static async replyToReport(reportId, responder, replyData) {
    try {
      const { body, attachments = [] } = replyData;
      
      const originalReport = await Report.findByPk(reportId);
      
      if (!originalReport) {
        throw new Error('Original report not found');
      }

      const isParticipant = (
        (originalReport.sender_id === responder.id && originalReport.sender_type === responder.type) ||
        (originalReport.recipient_id === responder.id && originalReport.recipient_type === responder.type)
      );

      if (!isParticipant) {
        throw new Error('You are not authorized to reply to this report');
      }

      const recipientId = originalReport.sender_id === responder.id ? 
        originalReport.recipient_id : originalReport.sender_id;
      const recipientType = originalReport.sender_id === responder.id ? 
        originalReport.recipient_type : originalReport.sender_type;

      const reply = await Report.create({
        title: `Re: ${originalReport.title}`,
        subject: originalReport.subject,
        body,
        priority: originalReport.priority,
        status: 'sent',
        
        sender_id: responder.id,
        sender_type: responder.type,
        
        recipient_id: recipientId,
        recipient_type: recipientType,
        
        parent_report_id: originalReport.thread_id || originalReport.id,
        thread_id: originalReport.thread_id || originalReport.id,
        
        attachments: attachments || [],
        sent_at: new Date(),
        last_activity_at: new Date()
      });

      await originalReport.update({
        status: 'replied',
        replied_at: new Date(),
        last_activity_at: new Date()
      });

      return {
        success: true,
        reply,
        message: 'Reply sent successfully'
      };
    } catch (error) {
      console.error('❌ Error in ReportService.replyToReport:', error);
      throw error;
    }
  }

  // ==================== CLOSE REPORT ====================
  static async closeReport(reportId, userId, userType) {
    try {
      const report = await Report.findOne({
        where: {
          id: reportId,
          [Op.or]: [
            { sender_id: userId, sender_type: userType },
            { recipient_id: userId, recipient_type: userType }
          ]
        }
      });

      if (!report) {
        throw new Error('Report not found');
      }

      await report.update({
        status: 'closed',
        closed_at: new Date(),
        last_activity_at: new Date()
      });

      return {
        success: true,
        message: 'Report closed successfully'
      };
    } catch (error) {
      console.error('❌ Error in ReportService.closeReport:', error);
      throw error;
    }
  }

  // ==================== REOPEN REPORT ====================
  static async reopenReport(reportId, userId, userType) {
    try {
      const report = await Report.findOne({
        where: {
          id: reportId,
          [Op.or]: [
            { sender_id: userId, sender_type: userType },
            { recipient_id: userId, recipient_type: userType }
          ]
        }
      });

      if (!report) {
        throw new Error('Report not found');
      }

      await report.update({
        status: 'reopened',
        closed_at: null,
        last_activity_at: new Date()
      });

      return {
        success: true,
        message: 'Report reopened successfully'
      };
    } catch (error) {
      console.error('❌ Error in ReportService.reopenReport:', error);
      throw error;
    }
  }
}

export default ReportService;