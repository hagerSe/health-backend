// models/Report.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Report = sequelize.define("Report", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  report_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  
  // Basic Info
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  
  // Message Parts
  opening: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "Dear [Recipient Name],"
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  closing: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "Sincerely,\n[Sender Name]\n[Sender Title]"
  },
  
  // Priority & Status
  priority: {
    type: DataTypes.ENUM("low", "medium", "high", "urgent"),
    defaultValue: "medium"
  },
  status: {
    type: DataTypes.ENUM("draft", "sent", "delivered", "opened", "replied", "resolved", "reopened", "closed"),
    defaultValue: "draft"
  },
  
  // SENDER INFORMATION
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sender_type: {
    type: DataTypes.ENUM("federal", "regional", "zone", "woreda", "kebele", "hospital", "staff"),
    allowNull: false
  },
  sender_first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  sender_middle_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  sender_full_name: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  sender_title: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  sender_region: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_zone: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_woreda: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_kebele: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_hospital: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  sender_department: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sender_signature: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // RECIPIENT INFORMATION
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  recipient_type: {
    type: DataTypes.ENUM("federal", "regional", "zone", "woreda", "kebele", "hospital", "staff"),
    allowNull: false
  },
  recipient_first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  recipient_middle_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  recipient_last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  recipient_full_name: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  recipient_title: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  recipient_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  recipient_region: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  recipient_zone: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  recipient_woreda: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  recipient_kebele: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  recipient_hospital: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  recipient_department: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  // Threading
  parent_report_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "reports",
      key: "id"
    }
  },
  thread_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
  // Timeline
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  opened_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  first_opened_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  replied_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_activity_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  // Tracking
  opened_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_opened: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Attachments
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  
  // Reply Info
  reply_to_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Metadata
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
  
}, {
  tableName: "reports",
  timestamps: true,
  hooks: {
    beforeCreate: async (report) => {
      console.log("🏷️ Running beforeCreate hook for report");
      
      // Set sender full name if not already set
      if (report.sender_first_name && report.sender_last_name && !report.sender_full_name) {
        report.sender_full_name = `${report.sender_first_name} ${report.sender_middle_name ? report.sender_middle_name + ' ' : ''}${report.sender_last_name}`.trim();
      }
      
      // Set recipient full name if not already set
      if (report.recipient_first_name && report.recipient_last_name && !report.recipient_full_name) {
        report.recipient_full_name = `${report.recipient_first_name} ${report.recipient_middle_name ? report.recipient_middle_name + ' ' : ''}${report.recipient_last_name}`.trim();
      }
      
      // Set sent_at if status is sent
      if (report.status === 'sent' && !report.sent_at) {
        report.sent_at = new Date();
      }
      
      // Ensure report_number exists
      if (!report.report_number) {
        console.error("❌ CRITICAL: report_number is missing in beforeCreate!");
        throw new Error("report_number is required and was not provided");
      }
    },
    
    afterCreate: async (report) => {
      console.log("✅ Running afterCreate hook for report ID:", report.id);
      
      // Update thread_id for root messages (no parent)
      if (!report.parent_report_id && !report.thread_id) {
        await report.update({ thread_id: report.id });
        console.log("✅ Set thread_id to:", report.id);
      }
      
      // If it has a parent but no thread_id, use parent's thread_id
      if (report.parent_report_id && !report.thread_id) {
        const parent = await Report.findByPk(report.parent_report_id);
        if (parent && parent.thread_id) {
          await report.update({ thread_id: parent.thread_id });
          console.log("✅ Set thread_id from parent:", parent.thread_id);
        }
      }
    }
  }
});

export default Report;