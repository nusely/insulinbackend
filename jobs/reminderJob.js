// backend/jobs/reminderJob.js

const cron = require("node-cron");
const Patient = require("../models/Patient");
const Dose = require("../models/Dose");
const { sendDoseReminderSMS } = require("../utils/smsService");

/**
 * @function calculateNextReminderTime
 * @description Calculate when to send the next reminder based on last dose time
 * @param {Date} lastDoseTime - Time of last logged dose
 * @returns {Date} Next reminder time (23.5 hours after last dose)
 */
const calculateNextReminderTime = (lastDoseTime) => {
  const reminderTime = new Date(lastDoseTime);
  // Add 23.5 hours (23 hours and 30 minutes)
  reminderTime.setHours(reminderTime.getHours() + 23);
  reminderTime.setMinutes(reminderTime.getMinutes() + 30);
  return reminderTime;
};

/**
 * @function calculateSecondReminderTime
 * @description Calculate when to send second reminder (24hr + 30min after last dose)
 * @param {Date} lastDoseTime - Time of last logged dose
 * @returns {Date} Second reminder time
 */
const calculateSecondReminderTime = (lastDoseTime) => {
  const reminderTime = new Date(lastDoseTime);
  // Add 24 hours and 30 minutes
  reminderTime.setHours(reminderTime.getHours() + 24);
  reminderTime.setMinutes(reminderTime.getMinutes() + 30);
  return reminderTime;
};

/**
 * @function updatePatientReminderData
 * @description Update patient's reminder tracking data when dose is logged
 * @param {string} patientId - Patient ID
 * @param {Date} doseTime - Time when dose was logged
 */
const updatePatientReminderData = async (patientId, doseTime) => {
  try {
    const nextReminderTime = calculateNextReminderTime(doseTime);

    await Patient.findByIdAndUpdate(patientId, {
      lastDoseTime: doseTime,
      nextReminderTime: nextReminderTime,
      reminderAttempts: 0, // Reset reminder attempts
      lastReminderSent: null,
    });

    console.log(
      `Updated reminder data for patient ${patientId}. Next reminder: ${nextReminderTime}`
    );
  } catch (error) {
    console.error("Error updating patient reminder data:", error);
  }
};

/**
 * @function scheduleReminderJob
 * @description Schedules a cron job to check for and send insulin dose reminders.
 * Runs every 30 minutes to check for patients who need reminders.
 */
const scheduleReminderJob = () => {
  // Run every 30 minutes to check for reminders
  cron.schedule("*/30 * * * *", async () => {
    console.log("Running SMS reminder check...");

    try {
      const now = new Date();

      // Find all active, verified patients who are not deactivated or soft-deleted
      const patients = await Patient.find({
        role: "patient",
        active: true,
        verified: true,
        deactivatedAt: null,
        isActive: { $ne: false }, // Exclude soft-deleted patients
      });

      for (const patient of patients) {
        // Skip if patient doesn't have a phone number
        if (!patient.phone) {
          continue;
        }

        // Find the patient's last dose (any type, but prioritize Basal)
        const lastDose = await Dose.findOne({
          patient: patient._id,
        }).sort({ timestamp: -1 });

        if (!lastDose) {
          // No doses logged yet, skip this patient
          continue;
        }

        const lastDoseTime = new Date(lastDose.timestamp);
        const firstReminderTime = calculateNextReminderTime(lastDoseTime);
        const secondReminderTime = calculateSecondReminderTime(lastDoseTime);

        // Check if it's time for first reminder (23.5 hours)
        if (now >= firstReminderTime && patient.reminderAttempts === 0) {
          // Check if dose was logged since the reminder time
          const doseAfterReminder = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: firstReminderTime },
          });

          if (!doseAfterReminder) {
            // Send first reminder
            try {
              const smsResult = await sendDoseReminderSMS(
                patient.phone,
                patient.name,
                1
              );

              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 1,
                  lastReminderSent: now,
                });
                console.log(
                  `First reminder SMS sent to ${patient.name} (${patient.phone})`
                );
              } else {
                console.error(
                  `Failed to send first reminder to ${patient.phone}:`,
                  smsResult.error
                );
              }
            } catch (error) {
              console.error(
                `Error sending first reminder to ${patient.name}:`,
                error
              );
            }
          }
        }

        // Check if it's time for second reminder (24hr + 30min)
        if (now >= secondReminderTime && patient.reminderAttempts === 1) {
          // Check if dose was logged since the second reminder time
          const doseAfterSecondReminder = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: secondReminderTime },
          });

          if (!doseAfterSecondReminder) {
            // Send second reminder
            try {
              const smsResult = await sendDoseReminderSMS(
                patient.phone,
                patient.name,
                2
              );

              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 2,
                  lastReminderSent: now,
                });
                console.log(
                  `Second reminder SMS sent to ${patient.name} (${patient.phone})`
                );
              } else {
                console.error(
                  `Failed to send second reminder to ${patient.phone}:`,
                  smsResult.error
                );
              }
            } catch (error) {
              console.error(
                `Error sending second reminder to ${patient.name}:`,
                error
              );
            }
          }
        }

        // Reset reminder cycle after 24hr + 30min if no dose was logged
        // This allows the cycle to restart for the next dose
        if (now >= secondReminderTime && patient.reminderAttempts >= 2) {
          // Reset for next cycle - calculate next reminder time based on expected dose time
          const nextExpectedDoseTime = new Date(lastDoseTime);
          nextExpectedDoseTime.setHours(nextExpectedDoseTime.getHours() + 24);

          const nextReminderTime =
            calculateNextReminderTime(nextExpectedDoseTime);

          await Patient.findByIdAndUpdate(patient._id, {
            nextReminderTime: nextReminderTime,
            reminderAttempts: 0,
            lastReminderSent: null,
          });

          console.log(
            `Reset reminder cycle for ${patient.name}. Next expected reminder: ${nextReminderTime}`
          );
        }
      }

      console.log("SMS reminder check completed.");
    } catch (error) {
      console.error("Error in SMS reminder job:", error);
    }
  });

  console.log("SMS reminder job scheduled to run every 30 minutes");
};

module.exports = {
  scheduleReminderJob,
  updatePatientReminderData,
  calculateNextReminderTime,
  calculateSecondReminderTime,
};
