// backend/controllers/doseController.js

const Dose = require("../models/Dose");
const Patient = require("../models/Patient"); // Import Patient model for populate to work
const { updatePatientReminderData } = require("../jobs/comprehensiveReminderJob");
const { sendSMS } = require("../utils/smsService"); // Add SMS service for logging notification
const { formatDoseDates } = require("../utils/dateUtils");

/**
 * @function logDose
 * @description Logs a new insulin dose for the authenticated user.
 * @route POST /api/doses
 * @access Private (Patient)
 */
exports.logDose = async (req, res) => {
  const { type, timestamp, notes } = req.body;
  const patientId = req.user.id; // Patient ID from the authenticated token

  try {
    console.log(`Logging new dose for patient ID: ${patientId}`);
    console.log(`Dose details: ${type} at ${timestamp}`);

    // Check for 20-hour restriction after basal dose
    const lastBasalDose = await Dose.findOne({
      patient: patientId,
      type: "Basal",
    }).sort({ timestamp: -1 });

    if (lastBasalDose) {
      const lastBasalTime = new Date(lastBasalDose.timestamp);
      const currentTime = new Date(timestamp);
      const hoursDifference = (currentTime - lastBasalTime) / (1000 * 60 * 60);

      if (hoursDifference < 20) {
        const hoursRemaining = Math.ceil(20 - hoursDifference);
        const minutesRemaining = Math.ceil((20 - hoursDifference) * 60) % 60;

        return res.status(400).json({
          msg: `You cannot log a new dose yet. Please wait ${hoursRemaining} hours and ${minutesRemaining} minutes after your last basal dose.`,
          restriction: {
            lastBasalDose: lastBasalTime,
            canLogNextAt: new Date(
              lastBasalTime.getTime() + 20 * 60 * 60 * 1000
            ),
            hoursRemaining: hoursRemaining,
            minutesRemaining: minutesRemaining,
          },
        });
      }
    }

    const newDose = new Dose({
      patient: patientId,
      type,
      timestamp,
      notes,
    });

    await newDose.save();

    // Update patient's reminder tracking data
    try {
      await updatePatientReminderData(patientId, newDose.timestamp);
    } catch (reminderError) {
      console.error("Error updating reminder data:", reminderError);
      // Don't fail dose logging if reminder update fails
    }

    const formattedDate = new Date(newDose.timestamp).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
    console.log(
      `Dose logged successfully: ${newDose.type} on ${formattedDate}`
    );

    res.status(201).json({ msg: "Dose logged successfully.", dose: newDose });
  } catch (err) {
    console.error("Error logging dose:", err.message);
    res.status(500).send("Server Error logging dose.");
  }
};

/**
 * @function getMyDoses
 * @description Retrieves all insulin doses for the authenticated patient.
 * @route GET /api/doses/me
 * @access Private (Patient)
 */
exports.getMyDoses = async (req, res) => {
  const patientId = req.user.id; // Patient ID from the authenticated token
  const { limit = 20, page = 1 } = req.query; // Reduced default limit for faster loading

  try {
    // Calculate skip for pagination (even for patients, useful for large histories)
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const doses = await Dose.find({ patient: patientId })
      .select("type timestamp notes") // Only select needed fields
      .sort({ timestamp: -1 }) // Sort by most recent
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean for better performance

    // Format dose dates
    const formattedDoses = doses.map(dose => formatDoseDates(dose));
    res.json(formattedDoses);
  } catch (err) {
    console.error("Error fetching patient doses:", err.message);
    res.status(500).send("Server Error fetching doses.");
  }
};

/**
 * @function getAllDoses
 * @description Retrieves all insulin doses for all patients with pagination and filters.
 * Allows filtering by patientId, doseType, startDate, endDate.
 * @route GET /api/doses/all
 * @access Private (Admin, Super Admin)
 */
exports.getAllDoses = async (req, res) => {
  const {
    patientId,
    doseType,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = req.query;
  let filter = {};

  // Build filter object based on query parameters
  if (patientId && patientId !== "all") {
    filter.patient = patientId;
  }
  if (doseType && doseType !== "all") {
    filter.type = doseType;
  }
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set to end of the day
      filter.timestamp.$lte = end;
    }
  }

  try {
    const startTime = Date.now();
    console.log("getAllDoses: Starting query with filter:", filter);

    // Set a reasonable timeout for the request (30 seconds)
    req.setTimeout(30000);

    // Add a timeout for the database operation (15 seconds)
    const dbOperationTimeout = 15000;

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Use a more optimized approach:
    // 1. Set a higher limit to reduce pagination overhead
    const actualLimit = Math.min(parseInt(limit), 100); // Cap at 100 for safety

    // 2. Use Promise.race to implement a timeout for the database operation
    const queryPromise = Promise.all([
      // Get estimated count instead of exact count - much faster for large collections
      Dose.estimatedDocumentCount().exec(),

      // Instead of filtering after populating, use a more efficient aggregation pipeline
      Dose.aggregate([
        { $match: filter }, // Apply the filter to doses
        { $sort: { timestamp: -1 } }, // Sort by most recent
        { $skip: skip },
        { $limit: actualLimit },
        {
          // More efficient join that can be filtered
          $lookup: {
            from: "patients", // The collection to join with
            localField: "patient", // Field from doses
            foreignField: "_id", // Field from patients
            as: "patientData", // Result array field
          },
        },
        // Unwind the patient data array to make it a single object
        { $unwind: { path: "$patientData", preserveNullAndEmptyArrays: true } },
        // Project fields we want in the final output
        {
          $project: {
            _id: 1,
            type: 1,
            timestamp: 1,
            notes: 1,
            date: 1,
            patient: "$patientData", // Replace patient field with detailed data
            patientName: {
              $cond: {
                if: { $eq: ["$patientData", null] },
                then: "Unknown Patient",
                else: {
                  $cond: {
                    if: { $eq: ["$patientData.isActive", false] },
                    then: {
                      $concat: ["$patientData.name", " (Deleted Account)"],
                    },
                    else: "$patientData.name",
                  },
                },
              },
            },
            patientId: { $ifNull: ["$patientData._id", null] },
          },
        },
      ]).exec(),
    ]);

    // Set timeout to prevent hanging database operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Database operation timed out")),
        dbOperationTimeout
      );
    });

    // Race between query completion and timeout
    const [totalDocsEstimate, dosesWithPatientName] = await Promise.race([
      queryPromise,
      timeoutPromise,
    ]);

    const queryTime = Date.now() - startTime;
    console.log(
      `getAllDoses: Found ${dosesWithPatientName.length} doses in ${queryTime}ms (estimated total: ${totalDocsEstimate})`
    );

    // Count doses without patients for logging purposes only
    const dosesWithMissingPatients = dosesWithPatientName.filter(
      (dose) => !dose.patient
    );
    if (dosesWithMissingPatients.length > 0) {
      console.log(
        `WARNING: Found ${dosesWithMissingPatients.length} doses with missing patient references`
      );
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalDocsEstimate / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    console.log(
      "getAllDoses: Successfully processed doses, returning:",
      dosesWithPatientName.length,
      "doses"
    );

    res.json({
      doses: dosesWithPatientName,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalDoses: totalDocsEstimate,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("Error fetching all doses:", err.message);
    console.error("Full error stack:", err);

    // Send a more specific error message based on the error type
    if (err.message === "Database operation timed out") {
      return res.status(503).json({
        error:
          "The request is taking too long to process. Please try applying more filters or reducing the page size.",
        code: "TIMEOUT",
        suggestion: "Try filtering by date range or patient to reduce results.",
      });
    }

    res.status(500).json({
      error: "Server Error fetching all doses.",
      message: err.message,
    });
  }
};

/**
 * @function getPatientDoses
 * @description Retrieves all insulin doses for a specific patient (for Admin/Super Admin)
 * @route GET /api/doses/patient/:patientId
 * @access Private (Admin, Super Admin)
 */
exports.getPatientDoses = async (req, res) => {
  const { patientId } = req.params;

  try {
    const doses = await Dose.find({ patient: patientId })
      .populate("patient", "name email")
      .sort({ timestamp: -1 });

    // Format dose dates
    const formattedDoses = doses.map(dose => formatDoseDates(dose));
    res.json(formattedDoses);
  } catch (err) {
    console.error("Error fetching patient doses:", err.message);
    res.status(500).send("Server Error fetching patient doses.");
  }
};

/**
 * @function updateDose
 * @description Updates an existing insulin dose.
 * @route PUT /api/doses/:id
 * @access Private (Patient - own dose, Admin/Super Admin - any dose)
 */
exports.updateDose = async (req, res) => {
  const { type, timestamp, notes } = req.body;
  const doseId = req.params.id;
  const patientId = req.user.id;
  const userRole = req.user.role;

  try {
    let dose = await Dose.findById(doseId);

    if (!dose) {
      return res.status(404).json({ msg: "Dose not found." });
    }

    // Authorization check: Patient can only update their own doses
    if (userRole === "patient" && dose.patient.toString() !== patientId) {
      return res
        .status(403)
        .json({ msg: "Not authorized to update this dose." });
    }

    // Update fields
    dose.type = type || dose.type;
    dose.timestamp = timestamp || dose.timestamp;
    dose.notes = notes !== undefined ? notes : dose.notes; // Allow notes to be cleared

    await dose.save();
    res.json({ msg: "Dose updated successfully.", dose });
  } catch (err) {
    console.error("Error updating dose:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid dose ID format." });
    }
    res.status(500).send("Server Error updating dose.");
  }
};

/**
 * @function deleteDose
 * @description Deletes an insulin dose.
 * @route DELETE /api/doses/:id
 * @access Private (Patient - own dose, Admin/Super Admin - any dose)
 */
exports.deleteDose = async (req, res) => {
  const doseId = req.params.id;
  const patientId = req.user.id;
  const userRole = req.user.role;

  try {
    const dose = await Dose.findById(doseId);

    if (!dose) {
      return res.status(404).json({ msg: "Dose not found." });
    }

    // Authorization check: Patient can only delete their own doses
    if (userRole === "patient" && dose.patient.toString() !== patientId) {
      return res
        .status(403)
        .json({ msg: "Not authorized to delete this dose." });
    }

    await dose.deleteOne(); // Use deleteOne() for Mongoose 6+
    res.json({ msg: "Dose removed successfully." });
  } catch (err) {
    console.error("Error deleting dose:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid dose ID format." });
    }
    res.status(500).send("Server Error deleting dose.");
  }
};
