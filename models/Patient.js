const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: ["patient", "admin", "superadmin"],
    default: "patient",
  },
  subscriptionType: {
    type: String,
    enum: ["Monthly", "Yearly", null],
    default: null,
  },
  subscriptionExpiry: {
    type: Date,
  },
  subscriptionRenewalCount: {
    type: Number,
    default: 0,
  },
  lastSubscriptionRenewal: {
    type: Date,
  },
  subscriptionRenewalHistory: [{
    renewedAt: {
      type: Date,
      default: Date.now,
    },
    renewedBy: {
      type: String,
      enum: ['admin', 'superadmin', 'system'],
    },
    previousExpiry: Date,
    newExpiry: Date,
    subscriptionType: String,
  }],
  active: {
    type: Boolean,
    default: false,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  deactivatedAt: {
    type: Date,
  },
  deactivationReason: {
    type: String,
    enum: [
      "Subscription expired", 
      "Manual deactivation - Medical reasons", 
      "Manual deactivation - Cost", 
      "Manual deactivation - Other", 
      "Manual deactivation - Account violation",
      "Manual deactivation - User request",
      "Manual deactivation - Technical issue",
      null
    ],
    default: null,
  },
  deactivatedBy: {
    type: String, // Admin/SuperAdmin ID who deactivated the user
    default: null,
  },
  deactivationNotes: {
    type: String, // Additional notes for deactivation reason
    default: null,
  },

  // SMS and Reminder Tracking
  welcomeSmsSent: {
    type: Boolean,
    default: false,
  },
  lastDoseTime: {
    type: Date,
  },
  nextReminderTime: {
    type: Date,
  },
  reminderAttempts: {
    type: Number,
    default: 0,
  },
  lastReminderSent: {
    type: Date,
  },
  
  // New SMS Logic Fields
  hasLoggedFirstDose: {
    type: Boolean,
    default: false,
  },
  smsReminderCycle: {
    type: String,
    enum: ['new_user', 'active_user', 'inactive_user', 'admin_notified'],
    default: 'new_user',
  },
  adminNotifiedDate: {
    type: Date,
  },
  lastActivationDate: {
    type: Date,
  },
  previousActiveState: {
    type: Boolean,
  },
  welcomeSmsSentAt: {
    type: Date,
  },

  date: {
    type: Date,
    default: Date.now,
  },
});

// Add database indexes for better performance
PatientSchema.index({ active: 1, role: 1 }); // Compound index for admin queries
PatientSchema.index({ verified: 1, role: 1 }); // Compound index for verification status queries
PatientSchema.index({ subscriptionExpiry: 1, active: 1 }); // Compound index for expiry queries
PatientSchema.index({ date: -1 }); // Index for sorting by creation date (use 'date' not 'createdAt')
PatientSchema.index({ name: "text", email: "text" }); // Text search index for admin search
PatientSchema.index({ isActive: 1 }); // Index for soft delete filtering
PatientSchema.index({ email: 1, isActive: 1 }); // Compound index for finding by email with active status

// New indexes for SMS and reminder functionality
PatientSchema.index({ nextReminderTime: 1 }); // Index for reminder queries
PatientSchema.index({ lastDoseTime: 1 }); // Index for dose tracking
PatientSchema.index({ smsReminderCycle: 1, active: 1 }); // Compound index for SMS cycle queries
PatientSchema.index({ hasLoggedFirstDose: 1, smsReminderCycle: 1 }); // Compound index for new user tracking
PatientSchema.index({ lastActivationDate: 1 }); // Index for reactivation tracking
PatientSchema.index({ adminNotifiedDate: 1 }); // Index for admin notification tracking

module.exports = mongoose.model("Patient", PatientSchema);
