const mongoose = require("mongoose");

const customMessageSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    patientEmail: {
      type: String,
      required: true,
    },
    patientName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    messageExcerpt: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search functionality
customMessageSchema.index({ patientEmail: 1, patientName: 1, message: "text" });

module.exports = mongoose.model("CustomMessage", customMessageSchema);
