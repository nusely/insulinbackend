// backend/jobs/subscriptionJob.js

const cron = require("node-cron");
const Patient = require("../models/Patient");
const {
  sendSubscriptionExpiryWarning,
  sendSubscriptionExpiryUrgent,
  sendSubscriptionExpiredNotification,
} = require("../utils/emailService");

/**
 * @function scheduleSubscriptionJob
 * @description Schedules a cron job to check for subscription expiry and send notifications
 * Runs daily at 9:00 AM to check subscription status
 */
const scheduleSubscriptionJob = () => {
  // Schedule to run every day at 9:00 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("Running subscription check job...");

    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

      // Find all active patients with subscription expiry dates (excluding soft-deleted)
      const patients = await Patient.find({
        active: true,
        verified: true,
        isActive: { $ne: false }, // Exclude soft-deleted patients
        subscriptionExpiry: { $exists: true },
      });

      console.log(`Found ${patients.length} active patients to check`);

      for (const patient of patients) {
        const expiryDate = new Date(patient.subscriptionExpiry);
        const timeDiff = expiryDate.getTime() - now.getTime();
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        console.log(
          `Patient ${patient.email}: ${daysUntilExpiry} days until expiry`
        );

        try {
          // Check if subscription expires in exactly 7 days
          if (daysUntilExpiry === 7) {
            console.log(`Sending 7-day warning to ${patient.email}`);
            await sendSubscriptionExpiryWarning(
              patient.email,
              patient.name,
              patient.subscriptionType,
              patient.subscriptionExpiry
            );
            console.log(`7-day warning sent to ${patient.email}`);
          }

          // Check if subscription expires in exactly 1 day
          else if (daysUntilExpiry === 1) {
            console.log(`Sending 1-day urgent warning to ${patient.email}`);
            await sendSubscriptionExpiryUrgent(
              patient.email,
              patient.name,
              patient.subscriptionType,
              patient.subscriptionExpiry
            );
            console.log(`1-day urgent warning sent to ${patient.email}`);
          }

          // Check if subscription has expired (0 days or negative)
          else if (daysUntilExpiry <= 0) {
            console.log(`Processing expired subscription for ${patient.email}`);

            // Only send expired notification once (when it just expired)
            if (daysUntilExpiry === 0) {
              await sendSubscriptionExpiredNotification(
                patient.email,
                patient.name,
                patient.subscriptionType,
                patient.subscriptionExpiry
              );
              console.log(`Expiry notification sent to ${patient.email}`);
            }

            // Deactivate the patient account if subscription is expired
            if (patient.active) {
              await Patient.findByIdAndUpdate(patient._id, {
                active: false,
                deactivatedAt: new Date(),
                deactivationReason: "Subscription expired",
              });
              console.log(
                `Account deactivated for ${patient.email} due to expired subscription`
              );
            }
          }
        } catch (emailError) {
          console.error(
            `Failed to send notification to ${patient.email}:`,
            emailError.message
          );
        }
      }

      console.log("Subscription check job completed");
    } catch (error) {
      console.error("Error in subscription check job:", error.message);
    }
  });

  console.log("Subscription check job scheduled to run daily at 9:00 AM");
};

/**
 * @function checkSubscriptionStatus
 * @description Manual function to check subscription status (can be called via API)
 * @returns {Object} Results of the subscription check
 */
const checkSubscriptionStatus = async () => {
  try {
    const now = new Date();

    const patients = await Patient.find({
      active: true,
      verified: true,
      subscriptionExpiry: { $exists: true },
      // Skip manually deactivated users - they shouldn't get subscription emails
      $or: [
        { deactivationReason: { $exists: false } },
        { deactivationReason: null },
        { deactivationReason: "Subscription expired" }
      ]
    });

    const results = {
      totalChecked: patients.length,
      sevenDayWarnings: 0,
      oneDayWarnings: 0,
      expired: 0,
      deactivated: 0,
      errors: [],
    };

    for (const patient of patients) {
      const expiryDate = new Date(patient.subscriptionExpiry);
      const timeDiff = expiryDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      try {
        if (daysUntilExpiry === 7) {
          await sendSubscriptionExpiryWarning(
            patient.email,
            patient.name,
            patient.subscriptionType,
            patient.subscriptionExpiry
          );
          results.sevenDayWarnings++;
        } else if (daysUntilExpiry === 1) {
          await sendSubscriptionExpiryUrgent(
            patient.email,
            patient.name,
            patient.subscriptionType,
            patient.subscriptionExpiry
          );
          results.oneDayWarnings++;
        } else if (daysUntilExpiry <= 0) {
          if (daysUntilExpiry === 0) {
            await sendSubscriptionExpiredNotification(
              patient.email,
              patient.name,
              patient.subscriptionType,
              patient.subscriptionExpiry
            );
            results.expired++;
          }

          if (patient.active) {
            await Patient.findByIdAndUpdate(patient._id, {
              active: false,
              deactivatedAt: new Date(),
              deactivationReason: "Subscription expired",
            });
            results.deactivated++;
          }
        }
      } catch (error) {
        results.errors.push({
          patientEmail: patient.email,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Subscription check failed: ${error.message}`);
  }
};

module.exports = {
  scheduleSubscriptionJob,
  checkSubscriptionStatus,
};
