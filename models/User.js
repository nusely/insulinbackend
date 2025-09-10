// This file is deprecated
// The application now uses Patient.js for all user types
// Do not use this model, import Patient from ../models/Patient instead

const Patient = require("./Patient");

// Re-export the Patient model as a temporary shim
// This helps avoid breaking changes while code is being updated
module.exports = Patient;
