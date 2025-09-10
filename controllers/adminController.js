const bcrypt = require("bcryptjs");
const Patient = require("../models/Patient");
const Admin = require("../models/Admin"); // For admin operations
const Dose = require("../models/Dose"); // Needed for deleting associated doses
const CustomMessage = require("../models/CustomMessage");
const { sendCustomReminderEmail } = require("../utils/emailService");
const { checkSubscriptionStatus } = require("../jobs/subscriptionJob");
const { formatPatientDates } = require("../utils/dateUtils");

// Cache for dashboard stats (1 minute cache) - cleared for structure fix
let dashboardCache = null;
let cacheExpiry = null;

/**
 * @function getDashboardStats
 * @description Get optimized dashboard statistics with caching
 * @route GET /api/admin/dashboard-stats
 * @access Private (Admin, Super Admin)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Check cache first (temporarily disabled for testing)
    // if (dashboardCache && cacheExpiry && Date.now() < cacheExpiry) {
    //   return res.json(dashboardCache);
    // }

    const startTime = Date.now();

    // Use aggregation pipeline for optimal performance
    const patientStats = await Patient.aggregate([
      {
        $facet: {
          totalPatients: [{ $match: { role: "patient" } }, { $count: "count" }],
          verifiedPatients: [
            { $match: { role: "patient", verified: true } },
            { $count: "count" },
          ],
          activePatients: [
            {
              $match: {
                role: "patient",
                active: true, // Use the active field instead of lastActive
              },
            },
            { $count: "count" },
          ],
          recentPatients: [
            { $match: { role: "patient" } },
            { $sort: { date: -1 } },
            { $limit: 8 },
            {
              $project: {
                name: 1,
                email: 1,
                verified: 1,
                active: 1,
                createdAt: "$date", // Map date field to createdAt for frontend compatibility
                lastActive: 1,
              },
            },
          ],
        },
      },
    ]);

    // Get dose statistics with aggregation
    const doseStats = await Dose.aggregate([
      {
        $facet: {
          totalDoses: [{ $count: "count" }],
          todayDoses: [
            {
              $match: {
                timestamp: {
                  $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  $lt: new Date(new Date().setHours(23, 59, 59, 999)),
                },
              },
            },
            { $count: "count" },
          ],
          recentDoses: [
            { $sort: { timestamp: -1 } },
            { $limit: 8 },
            {
              $lookup: {
                from: "patients",
                localField: "patient", // Use 'patient' field, not 'patientId'
                foreignField: "_id",
                as: "patientData",
              },
            },
            { $unwind: "$patientData" },
            {
              $project: {
                type: 1, // Use existing 'type' field
                timestamp: 1,
                notes: 1,
                patientName: "$patientData.name",
                units: { $literal: "N/A" }, // Placeholder since Dose model doesn't have units
              },
            },
          ],
        },
      },
    ]);

    // Get admin count
    const adminCount = await Admin.countDocuments();

    // Process aggregation results
    const [patientData] = patientStats;
    const [doseData] = doseStats;

    const stats = {
      totalPatients: patientData.totalPatients[0]?.count || 0,
      verifiedPatients: patientData.verifiedPatients[0]?.count || 0,
      activePatients: patientData.activePatients[0]?.count || 0,
      totalActivePatients: patientData.activePatients[0]?.count || 0, // Frontend expects this
      totalInactivePatients:
        (patientData.totalPatients[0]?.count || 0) -
        (patientData.activePatients[0]?.count || 0),
      patientsNearExpiry: 0, // TODO: Implement subscription expiry logic
      totalAdmins: adminCount,
      totalDoses: doseData.totalDoses[0]?.count || 0,
      totalDosesToday: doseData.todayDoses[0]?.count || 0, // Frontend expects this
      todayDoses: doseData.todayDoses[0]?.count || 0,
      recentPatients: patientData.recentPatients || [],
      recentDoses: doseData.recentDoses || [],
    };

    // Structure data to match frontend expectations
    const responseData = {
      stats: stats,
      recentData: {
        patients: stats.recentPatients,
        doses: stats.recentDoses,
      },
      queryTime: Date.now() - startTime,
    };

    // Cache the results for 1 minute
    dashboardCache = responseData;
    cacheExpiry = Date.now() + 60000; // 1 minute

    const endTime = Date.now();
    console.log(`Dashboard stats generated in ${endTime - startTime}ms`);

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Error fetching dashboard statistics" });
  }
};

/**
 * @function getPatientsList
 * @description Get paginated patients list with search and filters
 * @route GET /api/admin/patients
 * @access Private (Admin, Super Admin)
 */
exports.getPatientsList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all", // all, active, inactive, unverified
      sortBy = "date", // Use 'date' field instead of 'createdAt'
      sortOrder = "desc",
    } = req.query;

    const startTime = Date.now();

    // Build filter object
    let filter = { role: "patient" };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Add status filter
    switch (status) {
      case "active":
        filter.active = true;
        break;
      case "inactive":
        filter.active = false;
        break;
      case "unverified":
        filter.verified = false;
        break;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Always filter out soft-deleted patients unless specifically requested
    if (!req.query.includeDeleted) {
      filter.isActive = { $ne: false }; // Show only active patients by default
    }

    // Execute queries in parallel
    const [patients, totalCount] = await Promise.all([
      Patient.find(filter)
        .select("-password")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Patient.countDocuments(filter),
    ]);

    const queryTime = Date.now() - startTime;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Format patient dates
    const formattedPatients = patients.map(patient => formatPatientDates(patient));

    res.json({
      patients: formattedPatients,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit),
      },
      queryTime,
    });
  } catch (err) {
    console.error("Error fetching patients list:", err.message);
    res.status(500).json({ msg: "Server Error fetching patients list." });
  }
};

/**
 * @function bulkPatientAction
 * @description Perform bulk actions on patients (activate, deactivate, delete)
 * @route POST /api/admin/patients/bulk-action
 * @access Private (Admin, Super Admin)
 */
exports.bulkPatientAction = async (req, res) => {
  try {
    const { action, patientIds } = req.body;

    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({ msg: "Patient IDs array is required." });
    }

    const startTime = Date.now();
    let result;

    switch (action) {
      case "activate":
        result = await Patient.updateMany(
          { _id: { $in: patientIds }, role: "patient" },
          { active: true }
        );
        break;
      case "deactivate":
        result = await Patient.updateMany(
          { _id: { $in: patientIds }, role: "patient" },
          { active: false }
        );
        break;
      case "delete":
        // Soft delete patients instead of hard delete
        // This preserves dose history and allows for potential account recovery
        result = await Patient.updateMany(
          { _id: { $in: patientIds }, role: "patient" },
          { isActive: false, deletedAt: new Date() }
        );
        break;
      default:
        return res.status(400).json({ msg: "Invalid action." });
    }

    const queryTime = Date.now() - startTime;

    res.json({
      msg: `Bulk ${action} completed successfully.`,
      modifiedCount: result.modifiedCount || result.deletedCount,
      queryTime,
    });
  } catch (err) {
    console.error("Error performing bulk action:", err.message);
    res.status(500).json({ msg: "Server Error performing bulk action." });
  }
};

/**
 * @function getAllAdmins
 * @description Get all admin users - Super Admin only
 * @route GET /api/admin/admins
 * @access Private (Super Admin)
 */
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({}).select("-password");
    console.log(`getAllAdmins: Found ${admins.length} admin users`);
    res.json(admins);
  } catch (err) {
    console.error("Error fetching admins:", err.message);
    res.status(500).send("Server Error fetching admins.");
  }
};

/**
 * @function createAdmin
 * @description Creates a new Admin user. Only Super Admins can perform this action.
 * @route POST /api/admin/create-admin
 * @access Private (Super Admin)
 */
exports.createAdmin = async (req, res) => {
  const { name, email, phone, gender, password } = req.body;

  try {
    // Check if user already exists
    let user = await Admin.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ msg: "User with this email already exists." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new Admin user
    const newAdmin = new Admin({
      name,
      email,
      phone,
      gender,
      password: hashedPassword,
      role: "admin", // Explicitly set role to admin
      active: true, // Admins are active by default
      verified: true, // Admins are verified by default
    });

    await newAdmin.save();

    res.status(201).json({
      msg: "Admin user created successfully.",
      user: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });
  } catch (err) {
    console.error("Error creating admin:", err.message);
    res.status(500).send("Server Error creating admin.");
  }
};

/**
 * @function sendManualReminder
 * @description Simulates sending a manual reminder (e.g., SMS/Email) to a specific user.
 * @route POST /api/admin/send-manual-reminder
 * @access Private (Admin, Super Admin)
 */
exports.sendManualReminder = async (req, res) => {
  const { email, message } = req.body;

  try {
    const user = await Admin.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    // In a real application, you would integrate with an SMS or email service here.
    // For now, we'll just log the reminder.
    console.log(`--- MANUAL REMINDER SENT ---`);
    console.log(`To: ${user.name} (${user.email})`);
    console.log(`Message: "${message}"`);
    console.log(`----------------------------`);

    res
      .status(200)
      .json({ msg: `Manual reminder sent to ${user.name} (${user.email}).` });
  } catch (err) {
    console.error("Error sending manual reminder:", err.message);
    res.status(500).send("Server Error sending manual reminder.");
  }
};

/**
 * @function searchPatients
 * @description Search patients by email or name for reminder functionality
 * @route GET /api/admin/search-patients?q=query
 * @access Private (Admin only)
 */
exports.searchPatients = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res
        .status(400)
        .json({ msg: "Search query must be at least 2 characters" });
    }

    // Search by email or name (case insensitive)
    const patients = await Patient.find({
      $or: [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
      verified: true, // Only show verified patients
    })
      .select("_id name email")
      .limit(10);

    res.json(patients);
  } catch (err) {
    console.error("Search patients error:", err.message);
    res.status(500).send("Server Error during patient search.");
  }
};

/**
 * @function sendCustomMessage
 * @description Send custom reminder email to a patient and store the message
 * @route POST /api/admin/send-custom-message
 * @access Private (Admin only)
 */
exports.sendCustomMessage = async (req, res) => {
  try {
    const { patientId, message } = req.body;

    // Validate input
    if (!patientId || !message) {
      return res
        .status(400)
        .json({ msg: "Patient ID and message are required" });
    }

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ msg: "Patient not found" });
    }

    // Find the admin
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // Create message excerpt (first 100 characters)
    const messageExcerpt =
      message.length > 100 ? message.substring(0, 100) + "..." : message;

    // Create custom message record
    const customMessage = new CustomMessage({
      adminId: admin._id,
      adminName: admin.name,
      patientId: patient._id,
      patientEmail: patient.email,
      patientName: patient.name,
      message,
      messageExcerpt,
    });

    // Send email
    try {
      await sendCustomReminderEmail(patient.email, patient.name, message);
      customMessage.emailSent = true;
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      customMessage.emailSent = false;
    }

    // Save the message record
    await customMessage.save();

    res.status(200).json({
      msg: `Custom reminder sent to ${patient.name} (${patient.email})`,
      messageId: customMessage._id,
      emailSent: customMessage.emailSent,
    });
  } catch (err) {
    console.error("Send custom message error:", err.message);
    res.status(500).send("Server Error during custom message sending.");
  }
};

/**
 * @function getSentMessages
 * @description Get all sent custom messages with search functionality
 * @route GET /api/admin/sent-messages?search=query&page=1&limit=10
 * @access Private (Admin only)
 */
exports.getSentMessages = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build search query
    let searchQuery = {};
    if (search && search.length > 0) {
      searchQuery = {
        $or: [
          { patientEmail: { $regex: search, $options: "i" } },
          { patientName: { $regex: search, $options: "i" } },
          { message: { $regex: search, $options: "i" } },
          { adminName: { $regex: search, $options: "i" } },
        ],
      };
    }

    // Get messages with pagination
    const messages = await CustomMessage.find(searchQuery)
      .sort({ sentAt: -1 }) // Most recent first
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate("patientId", "name email")
      .populate("adminId", "name");

    // Get total count for pagination
    const totalMessages = await CustomMessage.countDocuments(searchQuery);

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit),
      },
    });
  } catch (err) {
    console.error("Get sent messages error:", err.message);
    res.status(500).send("Server Error during sent messages retrieval.");
  }
};

/**
 * @function getMessageDetails
 * @description Get full details of a sent message
 * @route GET /api/admin/sent-messages/:id
 * @access Private (Admin only)
 */
exports.getMessageDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await CustomMessage.findById(id)
      .populate("patientId", "name email")
      .populate("adminId", "name email");

    if (!message) {
      return res.status(404).json({ msg: "Message not found" });
    }

    res.json(message);
  } catch (err) {
    console.error("Get message details error:", err.message);
    res.status(500).send("Server Error during message details retrieval.");
  }
};

/**
 * @function deleteAdmin
 * @description Delete an admin user - Super Admin only
 * @route DELETE /api/admin/delete-admin/:id
 * @access Private (Super Admin only)
 */
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the admin to be deleted
    const adminToDelete = await Admin.findById(id);
    if (!adminToDelete) {
      return res.status(404).json({ msg: "Admin user not found." });
    }

    // Prevent super admin from deleting themselves
    if (adminToDelete._id.toString() === req.user.id) {
      return res.status(400).json({
        msg: "You cannot delete your own admin account.",
      });
    }

    // Prevent deleting other super admins (only super admins can delete regular admins)
    if (adminToDelete.role === "superadmin") {
      return res.status(403).json({
        msg: "Super admin accounts cannot be deleted.",
      });
    }

    // Delete the admin
    await Admin.findByIdAndDelete(id);

    console.log(
      `Admin deleted: ${adminToDelete.name} (${adminToDelete.email}) by ${req.user.id}`
    );

    res.status(200).json({
      msg: `Admin user ${adminToDelete.name} has been successfully deleted.`,
    });
  } catch (err) {
    console.error("Delete admin error:", err.message);
    res.status(500).send("Server Error during admin deletion.");
  }
};

/**
 * @function checkAllSubscriptions
 * @description Manually trigger subscription status check for all patients
 * @route POST /api/admin/check-subscriptions
 * @access Private (Super Admin only)
 */
exports.checkAllSubscriptions = async (req, res) => {
  try {
    console.log(
      "Manual subscription check initiated by admin:",
      req.user?.email || req.admin?.email
    );

    const result = await checkSubscriptionStatus();

    res.status(200).json({
      success: true,
      message: "Subscription check completed successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error in manual subscription check:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking subscriptions",
      error: error.message,
    });
  }
};

/**
 * @function resendMessage
 * @description Resend a failed custom message
 * @route POST /api/admin/resend-message/:id
 * @access Private (Admin, Super Admin)
 */
exports.resendMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const adminId = req.admin._id;

    // Find the message
    const message = await CustomMessage.findById(messageId).populate("patient");

    if (!message) {
      return res.status(404).json({
        success: false,
        msg: "Message not found",
      });
    }

    // Only allow resending failed messages
    if (message.emailSent) {
      return res.status(400).json({
        success: false,
        msg: "This message has already been sent successfully",
      });
    }

    // Try to resend the email
    try {
      await sendCustomReminderEmail(
        message.patient.email,
        message.patient.name,
        message.message
      );

      // Update the message status
      message.emailSent = true;
      message.sentAt = new Date();
      await message.save();

      console.log(
        `✅ Email resent successfully to ${message.patient.email} by admin ${req.admin.email}`
      );

      res.status(200).json({
        success: true,
        msg: "Message resent successfully!",
      });
    } catch (emailError) {
      console.error("❌ Email resend failed:", emailError);
      res.status(500).json({
        success: false,
        msg: "Failed to resend email. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error in resendMessage:", error);
    res.status(500).json({
      success: false,
      msg: "Server error while resending message",
      error: error.message,
    });
  }
};

// Note: User activation/deactivation and deletion are handled in users.js routes
// as they operate on individual patient users.

/**
 * @function cleanupOrphanedDoses
 * @description Delete doses associated with non-existent patients
 * @route POST /api/admin/cleanup-orphaned-doses
 * @access Private (Super Admin)
 */
exports.cleanupOrphanedDoses = async (req, res) => {
  try {
    // Import the cleanup utility
    const { deleteOrphanedDoses } = require("../utils/cleanupDoses");

    console.log("Starting cleanup of orphaned doses...");
    const startTime = Date.now();

    // Execute the cleanup function
    const deletedCount = await deleteOrphanedDoses();

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      message: `Successfully cleaned up ${deletedCount} orphaned doses`,
      deletedCount,
      processingTime: `${processingTime}ms`,
    });
  } catch (error) {
    console.error("Error cleaning up orphaned doses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clean up orphaned doses",
      error: error.message,
    });
  }
};
