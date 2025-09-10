const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DoseSchema = new Schema({
  patient: {
    type: Schema.Types.ObjectId, // This links the dose to a patient document
    ref: "Patient", // The 'Patient' model
    required: true,
  },
  type: {
    type: String,
    enum: ["Basal", "Bolus"],
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
  },
  notes: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// Add database indexes for better query performance
DoseSchema.index({ patient: 1, timestamp: -1 }); // Compound index for patient queries sorted by time
DoseSchema.index({ timestamp: -1 }); // Index for sorting by timestamp
DoseSchema.index({ type: 1 }); // Index for filtering by dose type
DoseSchema.index({ patient: 1, type: 1, timestamp: -1 }); // Compound index for filtered queries

module.exports = mongoose.model("Dose", DoseSchema);
