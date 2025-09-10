// backend/jobs/comprehensiveReminderJob.js

const cron = require("node-cron");
const Patient = require("../models/Patient");
const Dose = require("../models/Dose");
const Admin = require("../models/Admin");
const {
  sendNewUserReminderSMS,
  sendDoseReminderSMS,
  sendThirdReminderSMS,
  sendReactivationSMS,
  sendSmartReactivationSMS,
} = require("../utils/smsService");
const { sendInactiveUserNotificationToAdmins } = require("../utils/emailService");

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
 * @function calculateThirdReminderTime
 * @description Calculate when to send third reminder (24hr after second reminder)
 * @param {Date} secondReminderTime - Time of second reminder
 * @returns {Date} Third reminder time
 */
const calculateThirdReminderTime = (secondReminderTime) => {
  const reminderTime = new Date(secondReminderTime);
  // Add 24 hours
  reminderTime.setHours(reminderTime.getHours() + 24);
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
    const patient = await Patient.findById(patientId);
    if (!patient) return;

    const nextReminderTime = calculateNextReminderTime(doseTime);

    // Update patient data
    await Patient.findByIdAndUpdate(patientId, {
      lastDoseTime: doseTime,
      nextReminderTime: nextReminderTime,
      reminderAttempts: 0,
      lastReminderSent: null,
      hasLoggedFirstDose: true,
      smsReminderCycle: 'active_user', // Switch to active user cycle
    });

    console.log(
      `Updated reminder data for patient ${patientId}. Next reminder: ${nextReminderTime}`
    );
  } catch (error) {
    console.error("Error updating patient reminder data:", error);
  }
};

/**
 * @function handleReactivation
 * @description Handle reactivation logic when user becomes active
 * @param {Object} patient - Patient object
 */
const handleReactivation = async (patient) => {
  try {
    // Check if subscription has expired
    const now = new Date();
    const subscriptionExpired = patient.subscriptionExpiry && patient.subscriptionExpiry <= now;
    
    // Send smart reactivation SMS based on subscription status
    const smsResult = await sendSmartReactivationSMS(
      patient.phone, 
      patient.name, 
      subscriptionExpired, 
      patient.deactivationReason,
      patient
    );
    
    if (smsResult.success) {
      console.log(`Smart reactivation SMS sent to ${patient.name} (${patient.phone}) - Subscription expired: ${subscriptionExpired}`);
    } else {
      console.error(`Failed to send reactivation SMS to ${patient.phone}:`, smsResult.error);
    }

    // Reset SMS cycle to new_user to encourage first dose logging
    await Patient.findByIdAndUpdate(patient._id, {
      smsReminderCycle: 'new_user',
      hasLoggedFirstDose: false,
      reminderAttempts: 0,
      lastReminderSent: null,
      nextReminderTime: null,
      welcomeSmsSentAt: new Date(), // Mark that we've sent the reactivation SMS
    });

    console.log(`Smart reactivation handled for ${patient.name}`);
  } catch (error) {
    console.error("Error handling reactivation:", error);
  }
};

/**
 * @function sendAdminNotification
 * @description Send admin notification for inactive user
 * @param {Object} patient - Patient object
 */
const sendAdminNotification = async (patient) => {
  try {
    // Get last 5 doses
    const lastDoses = await Dose.find({ patient: patient._id })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('type timestamp');

    // Get last 3 reminder timestamps (we'll track this in the patient record)
    const lastReminders = [];
    if (patient.lastReminderSent) {
      lastReminders.push(patient.lastReminderSent);
    }

    // Get admin emails (excluding super admins)
    const admins = await Admin.find({ 
      active: true, 
      role: 'admin' // Only regular admins, not super admins
    }).select('email');
    
    const adminEmails = admins.map(admin => admin.email);

    if (adminEmails.length > 0) {
      await sendInactiveUserNotificationToAdmins(
        patient.name,
        patient.email,
        patient.phone,
        lastDoses,
        lastReminders,
        adminEmails
      );
      
      // Mark admin as notified
      await Patient.findByIdAndUpdate(patient._id, {
        adminNotifiedDate: new Date(),
        smsReminderCycle: 'admin_notified'
      });
      
      console.log(`Admin notification sent for inactive user: ${patient.name}`);
    } else {
      console.log("No admin emails found for inactive user notification");
    }
  } catch (error) {
    console.error("Error sending admin notification:", error);
  }
};

/**
 * @function scheduleComprehensiveReminderJob
 * @description Schedules a comprehensive cron job to handle all SMS reminder logic
 * Runs every 30 minutes to check for various reminder scenarios
 */
const scheduleComprehensiveReminderJob = () => {
  // Run every 30 minutes to check for reminders
  cron.schedule("*/30 * * * *", async () => {
    console.log("Running comprehensive SMS reminder check...");

    try {
      const now = new Date();

      // 1. Check for reactivations (active changed from false to true)
      // Only check patients who were recently reactivated (within last 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      const reactivatedPatients = await Patient.find({
        active: true,
        verified: true,
        previousActiveState: false, // Only patients who were previously inactive
        lastActivationDate: { 
          $exists: true,
          $gte: twoHoursAgo // Only recently reactivated (within last 2 hours)
        },
        $expr: {
          $gt: ["$lastActivationDate", "$date"] // lastActivationDate > date (account creation)
        }
      });

      for (const patient of reactivatedPatients) {
        // Check if we haven't already handled this reactivation
        const lastActivation = patient.lastActivationDate;
        const lastHandled = patient.welcomeSmsSentAt;
        
        // Only send reactivation SMS if:
        // 1. No welcome SMS was sent yet, OR
        // 2. The last activation was after the last welcome SMS sent
        if (!lastHandled || lastActivation > lastHandled) {
          console.log(`Processing reactivation for ${patient.name} - Last activation: ${lastActivation}, Last handled: ${lastHandled}`);
          await handleReactivation(patient);
        } else {
          console.log(`Skipping reactivation for ${patient.name} - Already handled`);
        }
      }

      // 2. Check new users (6 hours and 24 hours after welcome SMS)
      const newUsers = await Patient.find({
        role: "patient",
        active: true,
        verified: true,
        smsReminderCycle: 'new_user',
        welcomeSmsSent: true,
        welcomeSmsSentAt: { $exists: true },
        hasLoggedFirstDose: false,
        isActive: { $ne: false },
      });

      for (const patient of newUsers) {
        if (!patient.phone) continue;

        const welcomeSmsTime = new Date(patient.welcomeSmsSentAt);
        const sixHoursLater = new Date(welcomeSmsTime.getTime() + 6 * 60 * 60 * 1000);
        const twentyFourHoursLater = new Date(welcomeSmsTime.getTime() + 24 * 60 * 60 * 1000);

        // Check if it's time for 6-hour reminder
        if (now >= sixHoursLater && patient.reminderAttempts === 0) {
          // Check if user logged a dose since welcome SMS
          const doseAfterWelcome = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: welcomeSmsTime },
          });

          if (!doseAfterWelcome) {
            try {
              const smsResult = await sendNewUserReminderSMS(patient.phone, patient.name, 1);
              
              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 1,
                  lastReminderSent: now,
                });
                console.log(`6-hour reminder sent to new user: ${patient.name}`);
              }
            } catch (error) {
              console.error(`Error sending 6-hour reminder to ${patient.name}:`, error);
            }
          }
        }

        // Check if it's time for 24-hour reminder
        if (now >= twentyFourHoursLater && patient.reminderAttempts === 1) {
          // Check if user logged a dose since 6-hour reminder
          const doseAfterSixHour = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: sixHoursLater },
          });

          if (!doseAfterSixHour) {
            try {
              const smsResult = await sendNewUserReminderSMS(patient.phone, patient.name, 2);
              
              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 2,
                  lastReminderSent: now,
                  smsReminderCycle: 'inactive_user', // End new user cycle
                });
                console.log(`24-hour reminder sent to new user: ${patient.name}`);
              }
            } catch (error) {
              console.error(`Error sending 24-hour reminder to ${patient.name}:`, error);
            }
          }
        }
      }

      // 3. Check active users (23.5hr, 24.5hr, and 24hr after second reminder)
      const activeUsers = await Patient.find({
        role: "patient",
        active: true,
        verified: true,
        smsReminderCycle: 'active_user',
        hasLoggedFirstDose: true,
        isActive: { $ne: false },
      });

      for (const patient of activeUsers) {
        if (!patient.phone || !patient.lastDoseTime) continue;

        const lastDoseTime = new Date(patient.lastDoseTime);
        const firstReminderTime = calculateNextReminderTime(lastDoseTime);
        const secondReminderTime = calculateSecondReminderTime(lastDoseTime);
        const thirdReminderTime = calculateThirdReminderTime(secondReminderTime);

        // First reminder (23.5 hours)
        if (now >= firstReminderTime && patient.reminderAttempts === 0) {
          const doseAfterFirstReminder = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: firstReminderTime },
          });

          if (!doseAfterFirstReminder) {
            try {
              const smsResult = await sendDoseReminderSMS(patient.phone, patient.name, 1);
              
              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 1,
                  lastReminderSent: now,
                });
                console.log(`First reminder sent to active user: ${patient.name}`);
              }
            } catch (error) {
              console.error(`Error sending first reminder to ${patient.name}:`, error);
            }
          }
        }

        // Second reminder (24.5 hours)
        if (now >= secondReminderTime && patient.reminderAttempts === 1) {
          const doseAfterSecondReminder = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: secondReminderTime },
          });

          if (!doseAfterSecondReminder) {
            try {
              const smsResult = await sendDoseReminderSMS(patient.phone, patient.name, 2);
              
              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 2,
                  lastReminderSent: now,
                });
                console.log(`Second reminder sent to active user: ${patient.name}`);
              }
            } catch (error) {
              console.error(`Error sending second reminder to ${patient.name}:`, error);
            }
          }
        }

        // Third reminder (24 hours after second reminder)
        if (now >= thirdReminderTime && patient.reminderAttempts === 2) {
          const doseAfterThirdReminder = await Dose.findOne({
            patient: patient._id,
            timestamp: { $gte: thirdReminderTime },
          });

          if (!doseAfterThirdReminder) {
            try {
              const smsResult = await sendThirdReminderSMS(patient.phone, patient.name);
              
              if (smsResult.success) {
                await Patient.findByIdAndUpdate(patient._id, {
                  reminderAttempts: 3,
                  lastReminderSent: now,
                  smsReminderCycle: 'inactive_user',
                });
                console.log(`Third reminder sent to active user: ${patient.name}`);
              }
            } catch (error) {
              console.error(`Error sending third reminder to ${patient.name}:`, error);
            }
          }
        }
      }

      // 4. Check inactive users for admin notification
      const inactiveUsers = await Patient.find({
        role: "patient",
        active: true,
        verified: true,
        smsReminderCycle: 'inactive_user',
        reminderAttempts: 3,
        adminNotifiedDate: { $exists: false }, // Not yet notified
        isActive: { $ne: false },
      });

      for (const patient of inactiveUsers) {
        await sendAdminNotification(patient);
      }

      console.log("Comprehensive SMS reminder check completed.");
    } catch (error) {
      console.error("Error in comprehensive SMS reminder job:", error);
    }
  });

  console.log("Comprehensive SMS reminder job scheduled to run every 30 minutes");
};

module.exports = {
  scheduleComprehensiveReminderJob,
  updatePatientReminderData,
  calculateNextReminderTime,
  calculateSecondReminderTime,
  calculateThirdReminderTime,
  handleReactivation,
};
