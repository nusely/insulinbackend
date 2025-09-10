// backend/routes/admin.js

const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { formatPatientDates } = require("../utils/dateUtils");

// @route   GET /api/admin/dashboard-stats
// @desc    Get optimized dashboard statistics
// @access  Private (Admin, Super Admin)
router.get(
  "/dashboard-stats",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.getDashboardStats
);

// @route   GET /api/admin/patients
// @desc    Get paginated patients list with search and filters
// @access  Private (Admin, Super Admin)
router.get(
  "/patients",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.getPatientsList
);

// @route   POST /api/admin/patients/bulk-action
// @desc    Perform bulk actions on patients
// @access  Private (Admin, Super Admin)
router.post(
  "/patients/bulk-action",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.bulkPatientAction
);

// @route   GET /api/admin/admins
// @desc    Get all admin users - Super Admin only
// @access  Private (Super Admin)
router.get(
  "/admins",
  protect,
  authorizeRoles(["superadmin"]),
  adminController.getAllAdmins
);

// @route   POST /api/admin/cleanup-orphaned-doses
// @desc    Delete doses with non-existent patients
// @access  Private (Super Admin)
router.post(
  "/cleanup-orphaned-doses",
  protect,
  authorizeRoles(["superadmin"]),
  adminController.cleanupOrphanedDoses
);

// @route   POST /api/admin/create-admin
// @desc    Create a new Admin user
// @access  Private (Super Admin Only)
router.post(
  "/create-admin",
  protect,
  authorizeRoles(["superadmin"]),
  adminController.createAdmin
);

// @route   POST /api/admin/send-manual-reminder
// @desc    Send a manual reminder to a user
// @access  Private (Admin, Super Admin)
router.post(
  "/send-manual-reminder",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.sendManualReminder
);

// @route   GET /api/admin/search-patients
// @desc    Search patients by email or name
// @access  Private (Admin, Super Admin)
router.get(
  "/search-patients",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.searchPatients
);

// @route   POST /api/admin/send-custom-message
// @desc    Send custom reminder email to a patient
// @access  Private (Admin, Super Admin)
router.post(
  "/send-custom-message",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.sendCustomMessage
);

// @route   GET /api/admin/sent-messages
// @desc    Get all sent custom messages with search
// @access  Private (Admin, Super Admin)
router.get(
  "/sent-messages",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.getSentMessages
);

// @route   GET /api/admin/sent-messages/:id
// @desc    Get details of a specific sent message
// @access  Private (Admin, Super Admin)
router.get(
  "/sent-messages/:id",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.getMessageDetails
);

// @route   POST /api/admin/resend-message/:id
// @desc    Resend a failed custom message
// @access  Private (Admin, Super Admin)
router.post(
  "/resend-message/:id",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  adminController.resendMessage
);

// @route   DELETE /api/admin/delete-admin/:id
// @desc    Delete an admin user
// @access  Private (Super Admin only)
router.delete(
  "/delete-admin/:id",
  protect,
  authorizeRoles(["superadmin"]),
  adminController.deleteAdmin
);

// @route   POST /api/admin/check-subscriptions
// @desc    Manually trigger subscription status check for all patients
// @access  Private (Super Admin only)
router.post(
  "/check-subscriptions",
  protect,
  authorizeRoles(["superadmin"]),
  adminController.checkAllSubscriptions
);

module.exports = router;
