// cleanupDoses.js - A simpler version to be run from Node.js REPL
const mongoose = require("mongoose");
const Dose = require("./models/Dose");

/**
 * Function to delete doses with non-existent patients
 */
async function deleteOrphanedDoses() {
  try {
    console.log("Finding orphaned doses...");

    // Step 1: Find all doses
    const allDoses = await Dose.find().lean();
    console.log(`Total doses in database: ${allDoses.length}`);

    // Step 2: Populate patient data and find orphaned doses
    const doses = await Dose.find().populate("patient").lean();

    // Step 3: Filter to only doses with null patient
    const orphanedDoses = doses.filter((dose) => !dose.patient);
    console.log(`Found ${orphanedDoses.length} orphaned doses`);

    if (orphanedDoses.length > 0) {
      // Get IDs of orphaned doses
      const orphanedDoseIds = orphanedDoses.map((dose) => dose._id);

      // Delete the orphaned doses
      const result = await Dose.deleteMany({ _id: { $in: orphanedDoseIds } });
      console.log(`Successfully deleted ${result.deletedCount} orphaned doses`);
      return result.deletedCount;
    } else {
      console.log("No orphaned doses found. Database is clean.");
      return 0;
    }
  } catch (error) {
    console.error("Error deleting orphaned doses:", error);
    throw error;
  }
}

module.exports = { deleteOrphanedDoses };
