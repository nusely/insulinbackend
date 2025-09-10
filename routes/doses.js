// backend/routes/doses.js

const express = require("express");
const router = express.Router();
const doseController = require("../controllers/doseController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { 
  validateDoseLogging, 
  handleValidationErrors, 
  checkDuplicateDose, 
  checkSubscriptionStatus 
} = require("../middleware/validation/doseValidation");

// @route   POST /api/doses
// @desc    Log a new insulin dose
// @access  Private (Patient)
router.post("/", 
  protect, 
  authorizeRoles(["patient"]), 
  checkSubscriptionStatus,
  validateDoseLogging, 
  handleValidationErrors,
  checkDuplicateDose,
  doseController.logDose
);

// @route   GET /api/doses/me
// @desc    Get authenticated patient's dose history
// @access  Private (Patient)
router.get(
  "/me",
  protect,
  authorizeRoles(["patient"]),
  doseController.getMyDoses
);

// @route   GET /api/doses/all
// @desc    Get all doses (for Admin/Super Admin) with filters
// @access  Private (Admin, Super Admin)
router.get(
  "/all",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  doseController.getAllDoses
);

// @route   GET /api/doses/patient/:patientId
// @desc    Get doses for a specific patient (for Admin/Super Admin)
// @access  Private (Admin, Super Admin)
router.get(
  "/patient/:patientId",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  doseController.getPatientDoses
);

// @route   PUT /api/doses/:id
// @desc    Update an insulin dose
// @access  Private (Patient - own dose, Admin/Super Admin - any dose)
router.put(
  "/:id",
  protect,
  authorizeRoles(["patient", "admin", "superadmin"]),
  doseController.updateDose
);

// @route   DELETE /api/doses/:id
// @desc    Delete an insulin dose
// @access  Private (Patient - own dose, Admin/Super Admin - any dose)
router.delete(
  "/:id",
  protect,
  authorizeRoles(["patient", "admin", "superadmin"]),
  doseController.deleteDose
);

module.exports = router;
