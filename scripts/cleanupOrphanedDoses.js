// Script to delete doses with unknown/deleted patients
require("dotenv").config();
const mongoose = require("mongoose");
const Dose = require("../models/Dose");

/**
 * Script to find and delete doses that reference non-existent patients
 */
async function cleanupOrphanedDoses() {
  try {
    console.log("Connecting to MongoDB...");
    // Connect to MongoDB using URI from .env
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB successfully");

    // Find doses with patients that don't exist
    // Using aggregation pipeline to find doses where the patient reference doesn't exist
    console.log("Finding orphaned doses...");
    const orphanedDoses = await Dose.aggregate([
      {
        $lookup: {
          from: "patients", // Collection name for Patient model
          localField: "patient",
          foreignField: "_id",
          as: "patientData",
        },
      },
      {
        $match: {
          patientData: { $size: 0 }, // Only get doses where patient doesn't exist
        },
      },
    ]);

    console.log(`Found ${orphanedDoses.length} orphaned doses`);

    if (orphanedDoses.length > 0) {
      // Print some examples of orphaned doses
      console.log("Examples of orphaned doses:");
      orphanedDoses.slice(0, 3).forEach((dose) => {
        console.log(
          `- Dose ID: ${dose._id}, Patient ID: ${dose.patient}, Type: ${dose.type}, Timestamp: ${dose.timestamp}`
        );
      });

      // Extract the IDs of orphaned doses
      const orphanedDoseIds = orphanedDoses.map((dose) => dose._id);

      // Ask for confirmation before deleting
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      readline.question(
        `Are you sure you want to delete ${orphanedDoses.length} orphaned doses? (yes/no): `,
        async (answer) => {
          if (answer.toLowerCase() === "yes") {
            // Delete the orphaned doses
            const result = await Dose.deleteMany({
              _id: { $in: orphanedDoseIds },
            });
            console.log(
              `Successfully deleted ${result.deletedCount} orphaned doses`
            );
          } else {
            console.log("Operation cancelled. No doses were deleted.");
          }

          readline.close();
          await mongoose.disconnect();
          console.log("Disconnected from MongoDB");
        }
      );
    } else {
      console.log("No orphaned doses found. Database is clean.");
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the cleanup function
cleanupOrphanedDoses();
