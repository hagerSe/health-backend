import Notification from "../models/Notification.js";
import { Op } from "sequelize";

class NotificationService {
  
  // ==================== GET USER NOTIFICATIONS ====================
  static async getUserNotifications(userId, userType, filters = {}) {
    try {
      const { page = 1, limit = 20, unreadOnly = false, type } = filters;
      const offset = (page - 1) * limit;

      const whereClause = {
        recipient_id: userId,
        recipient_type: userType
      };

      if (unreadOnly) {
        whereClause.is_read = false;
      }

      if (type) {
        whereClause.type = type;
      }

      const notifications = await Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const unreadCount = await Notification.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          is_read: false
        }
      });

      const urgentUnreadCount = await Notification.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          priority: 'urgent',
          is_read: false
        }
      });

      return {
        success: true,
        notifications: notifications.rows,
        unreadCount,
        urgentUnreadCount,
        totalCount: notifications.count,
        totalPages: Math.ceil(notifications.count / limit),
        currentPage: parseInt(page)
      };

    } catch (error) {
      console.error("Get notifications error:", error);
      throw error;
    }
  }

  // ==================== MARK AS READ ====================
  static async markAsRead(notificationId, userId, userType) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          recipient_id: userId,
          recipient_type: userType
        }
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      await notification.update({
        is_read: true,
        read_at: new Date()
      });

      return {
        success: true,
        message: "Notification marked as read"
      };

    } catch (error) {
      console.error("Mark as read error:", error);
      throw error;
    }
  }

  // ==================== MARK ALL AS READ ====================
  static async markAllAsRead(userId, userType) {
    try {
      await Notification.update(
        { is_read: true, read_at: new Date() },
        {
          where: {
            recipient_id: userId,
            recipient_type: userType,
            is_read: false
          }
        }
      );

      return {
        success: true,
        message: "All notifications marked as read"
      };

    } catch (error) {
      console.error("Mark all as read error:", error);
      throw error;
    }
  }

  // ==================== CREATE NOTIFICATION ====================
  static async create(data) {
    try {
      const notification = await Notification.create(data);
      return {
        success: true,
        notification
      };
    } catch (error) {
      console.error("Create notification error:", error);
      throw error;
    }
  }

  // ==================== CREATE BULK NOTIFICATIONS ====================
  static async createBulk(notificationsData) {
    try {
      const notifications = await Notification.bulkCreate(notificationsData);
      return {
        success: true,
        count: notifications.length,
        notifications
      };
    } catch (error) {
      console.error("Create bulk notifications error:", error);
      throw error;
    }
  }

  // ==================== DELETE OLD NOTIFICATIONS ====================
  static async deleteOld(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const deleted = await Notification.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
          is_read: true // Only delete read notifications
        }
      });

      return {
        success: true,
        deletedCount: deleted
      };

    } catch (error) {
      console.error("Delete old notifications error:", error);
      throw error;
    }
  }

  // ==================== GET UNREAD COUNT ====================
  static async getUnreadCount(userId, userType) {
    try {
      const count = await Notification.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          is_read: false
        }
      });

      return {
        success: true,
        count
      };

    } catch (error) {
      console.error("Get unread count error:", error);
      throw error;
    }
  }

  // ==================== GET URGENT UNREAD COUNT ====================
  static async getUrgentUnreadCount(userId, userType) {
    try {
      const count = await Notification.count({
        where: {
          recipient_id: userId,
          recipient_type: userType,
          priority: 'urgent',
          is_read: false
        }
      });

      return {
        success: true,
        count
      };

    } catch (error) {
      console.error("Get urgent unread count error:", error);
      throw error;
    }
  }
}

export default NotificationService;