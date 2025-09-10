const sendEmailFixed = require("./sendEmailFixed");

/**
 * @function sendVerificationEmail
 * @description Sends email verification link that works in all scenarios.
 * @param {string} email - The recipient's email address.
 * @param {string} token - The verification token.
 * @param {Object} req - Express request object to get host info
 */
exports.sendVerificationEmail = async (email, token, req = null) => {
  // Use BASE_URL for verification link
  // If running in production, BASE_URL should be set in environment variables (e.g., https://insulinlog.batistasimons.com/insulinbackend)
  // If not set, fallback to localhost for development
  const baseUrl =
    process.env.BASE_URL && process.env.BASE_URL.trim() !== ""
      ? process.env.BASE_URL
      : "http://localhost:5000";
  // Ensure BASE_URL doesn't have a trailing slash
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  // Create the verification link with the token
  const verificationLink = `${cleanBaseUrl}/verify-email/${token}`;

  // Log the link for debugging
  console.log(`Generated verification link: ${verificationLink}`);

  console.log(`Sending verification email to: ${email}`);
  console.log(`Verification link: ${verificationLink}`);

  try {
    const result = await sendEmailFixed({
      to: email,
      subject: "InsulinLog: Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
  <p style="color: #374151; font-size: 16px;">
    Hello,
  </p>

  <p style="color: #374151; font-size: 16px;">
    Thank you for registering with <strong>InsulinLog</strong>. To complete your registration, please verify your email address by clicking the button below:
  </p>

  <p style="text-align: center; margin: 32px 0;">
    <a href="${verificationLink}" style="background-color: #3B82F6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
      Verify Email Address
    </a>
  </p>

  <p style="color: #6b7280; font-size: 14px;">
    If the button above doesn't work, copy and paste the link below into your browser:
  </p>

  <p style="background-color: #f9fafb; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-word; color: #1f2937; font-size: 14px;">
    ${verificationLink}
  </p>

  <p style="color: #6b7280; font-size: 14px;">
    This link will expire in <strong>1 hour</strong>.
  </p>

  <p style="color: #6b7280; font-size: 14px;">
    If you did not register for an account, you can safely ignore this email.
  </p>

  <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">

  <p style="color: #374151; font-size: 14px;">
    Best regards,<br>
    <strong>The Metabolic Health Revival Team</strong>
  </p>
</div>

      `,
    });
    console.log("Verification email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("Failed to send verification email:", error.message);
    throw error;
  }
};

/**
 * @function sendPasswordResetEmail
 * @description Simulates sending a password reset link to the user.
 * @param {string} email - The recipient's email address.
 * @param {string} token - The password reset token.
 */
exports.sendPasswordResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  await sendEmailFixed({
    to: email,
    subject: "InsulinLog: Password Reset Request",
    html: `
      <p>Hello,</p>
      <p>You have requested to reset your password for your InsulinLog account. Please click the link below to reset your password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <p>Best regards,</p>
      <p>The Metabolic Health Revival Team</p>
    `,
  });
};

/**
 * @function sendCustomReminderEmail
 * @description Sends a custom reminder email to a patient
 * @param {string} email - The recipient's email address.
 * @param {string} name - The recipient's name.
 * @param {string} message - The custom message to send.
 */
exports.sendCustomReminderEmail = async (email, name, message) => {
  await sendEmailFixed({
    to: email,
    subject: "InsulinLog: Custom Reminder",
    html: `
      <p>Hello ${name},</p>
      <p>You have received a custom reminder from the InsulinLog team:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
        ${message.replace(/\n/g, "<br>")}
      </div>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,</p>
      <p>The Metabolic Health Revival Team</p>
    `,
  });
};

/**
 * @function sendSubscriptionExpiryWarning
 * @description Sends a warning email when subscription expires in 7 days
 * @param {string} email - The recipient's email address.
 * @param {string} name - The recipient's name.
 * @param {string} subscriptionType - The subscription type.
 * @param {Date} expiryDate - The expiry date.
 */
exports.sendSubscriptionExpiryWarning = async (
  email,
  name,
  subscriptionType,
  expiryDate
) => {
  const formattedDate = new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  await sendEmailFixed({
    to: email,
    subject: "InsulinLog: Subscription Expires in 7 Days - Renew Now",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #2563eb; margin: 0;">InsulinLog</h1>
          <h2 style="color: #dc2626; margin: 10px 0 0 0;">⚠️ Subscription Expiring Soon</h2>
        </div>
        
        <div style="padding: 30px; background-color: white;">
          <p>Hello ${name},</p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">
              Your ${subscriptionType} subscription will expire in 7 days on ${formattedDate}.
            </p>
          </div>
          
          <p>To continue using InsulinLog without interruption, please renew your subscription before the expiry date.</p>
          
          <h3 style="color: #1f2937;">How to Renew:</h3>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>📱 WhatsApp:</strong> +233553018172</p>
            <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> support@metabolichealth.com</p>
            <p style="margin: 0;"><strong>📞 Phone:</strong> 0304543372</p>
          </div>
          
          <p>Your health tracking is important to us. Don't let your subscription expire!</p>
          
          <p>Best regards,<br>The Metabolic Health Revival Team</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;">
          This is an automated reminder. Please do not reply to this email.
        </div>
      </div>
    `,
  });
};

/**
 * @function sendSubscriptionExpiryUrgent
 * @description Sends an urgent email when subscription expires in 1 day
 * @param {string} email - The recipient's email address.
 * @param {string} name - The recipient's name.
 * @param {string} subscriptionType - The subscription type.
 * @param {Date} expiryDate - The expiry date.
 */
exports.sendSubscriptionExpiryUrgent = async (
  email,
  name,
  subscriptionType,
  expiryDate
) => {
  const formattedDate = new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  await sendEmailFixed({
    to: email,
    subject: "⚠️ URGENT: InsulinLog Subscription Expires Tomorrow!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">InsulinLog</h1>
          <h2 style="color: white; margin: 10px 0 0 0;">🚨 URGENT: Expires Tomorrow!</h2>
        </div>
        
        <div style="padding: 30px; background-color: white;">
          <p>Hello ${name},</p>
          
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 16px;">
              ⏰ Your ${subscriptionType} subscription expires TOMORROW (${formattedDate})!
            </p>
          </div>
          
          <p><strong>Action Required:</strong> Renew now to avoid service interruption.</p>
          
          <h3 style="color: #1f2937;">Renew Immediately:</h3>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>📱 WhatsApp (Fastest):</strong> +233553018172</p>
            <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> support@metabolichealth.com</p>
            <p style="margin: 0;"><strong>📞 Phone:</strong> 0304543372</p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>Important:</strong> If not renewed by tomorrow, your account will be temporarily suspended until renewal is completed.
            </p>
          </div>
          
          <p>Don't lose access to your health data. Renew now!</p>
          
          <p>Best regards,<br>The Metabolic Health Revival Team</p>
        </div>
        
        <div style="background-color: #fee2e2; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #991b1b;">
          This is an urgent automated reminder. Please contact us immediately to renew.
        </div>
      </div>
    `,
  });
};

/**
 * @function sendSubscriptionExpiredNotification
 * @description Sends notification when subscription has expired
 * @param {string} email - The recipient's email address.
 * @param {string} name - The recipient's name.
 * @param {string} subscriptionType - The subscription type.
 * @param {Date} expiryDate - The expiry date.
 */
exports.sendSubscriptionExpiredNotification = async (
  email,
  name,
  subscriptionType,
  expiryDate
) => {
  const formattedDate = new Date(expiryDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  await sendEmailFixed({
    to: email,
    subject: "InsulinLog: Subscription Expired - Renew to Restore Access",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #7f1d1d; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">InsulinLog</h1>
          <h2 style="color: white; margin: 10px 0 0 0;">🔒 Subscription Expired</h2>
        </div>
        
        <div style="padding: 30px; background-color: white;">
          <p>Hello ${name},</p>
          
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 16px;">
              Your ${subscriptionType} subscription expired on ${formattedDate}.
            </p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>Account Status:</strong> Your account has been temporarily suspended. You can no longer log doses or access premium features until your subscription is renewed.
            </p>
          </div>
          
          <h3 style="color: #1f2937;">Restore Access - Renew Now:</h3>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>📱 WhatsApp:</strong> +233553018172</p>
            <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> support@metabolichealth.com</p>
            <p style="margin: 0;"><strong>📞 Phone:</strong> 0304543372</p>
          </div>
          
          <p><strong>What happens next:</strong></p>
          <ul style="color: #4b5563;">
            <li>Contact us using any method above to renew your subscription</li>
            <li>Once renewed, your account will be immediately reactivated</li>
            <li>All your historical data is safely preserved</li>
            <li>You'll regain full access to all features</li>
          </ul>
          
          <p>We value your health journey with us. Renew today to continue tracking your progress!</p>
          
          <p>Best regards,<br>The Metabolic Health Revival Team</p>
        </div>
        
        <div style="background-color: #fee2e2; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #991b1b;">
          Account suspended due to expired subscription. Contact support to restore access.
        </div>
      </div>
    `,
  });
};

/**
 * @function sendNewRegistrationNotificationToAdmins
 * @description Sends email notification to all admins when a new patient registers
 * @param {string} patientName - The name of the new patient
 * @param {string} patientEmail - The email of the new patient
 * @param {string} patientPhone - The phone number of the new patient
 * @param {string} patientGender - The gender of the new patient
 * @param {string} subscriptionType - The subscription type chosen by the patient
 * @param {Array} adminEmails - Array of admin email addresses
 */
exports.sendNewRegistrationNotificationToAdmins = async (
  patientName,
  patientEmail,
  patientPhone,
  patientGender,
  subscriptionType,
  adminEmails
) => {
  const formattedDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Send email to each admin
  for (const adminEmail of adminEmails) {
    try {
      await sendEmailFixed({
        to: adminEmail,
        subject: "🔔 InsulinLog: New Patient Registration",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #2563eb; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">InsulinLog</h1>
              <h2 style="color: white; margin: 10px 0 0 0;">🔔 New Patient Registration</h2>
            </div>
            
            <div style="padding: 30px; background-color: white;">
              <p>Hello Admin,</p>
              
              <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #1e40af; font-size: 16px;">
                  A new patient has registered on InsulinLog!
                </p>
              </div>
              
              <h3 style="color: #1f2937;">Patient Details:</h3>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>👤 Name:</strong> ${patientName}</p>
                <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> ${patientEmail}</p>
                <p style="margin: 0 0 10px 0;"><strong>📞 Phone:</strong> ${patientPhone}</p>
                <p style="margin: 0 0 10px 0;"><strong>⚧ Gender:</strong> ${patientGender}</p>
                <p style="margin: 0;"><strong>💳 Subscription:</strong> ${subscriptionType}</p>
              </div>
              
              <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                  <strong>📅 Registration Date:</strong> ${formattedDate}
                </p>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul style="color: #4b5563;">
                <li>The patient will receive a verification email to activate their account</li>
                <li>Once verified, they will have access to their dashboard</li>
                <li>You can monitor their activity through the admin panel</li>
                <li>Their subscription will start upon email verification</li>
              </ul>
              
              <p>Best regards,<br>The InsulinLog System</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;">
              This is an automated notification. Please do not reply to this email.
            </div>
          </div>
        `,
      });

      console.log(`New registration notification sent to admin: ${adminEmail}`);
    } catch (error) {
      console.error(
        `Failed to send new registration notification to ${adminEmail}:`,
        error.message
      );
      // Continue sending to other admins even if one fails
    }
  }
};

/**
 * @function sendInactiveUserNotificationToAdmins
 * @description Sends email notification to admins when a user becomes inactive
 * @param {string} patientName - The name of the inactive patient
 * @param {string} patientEmail - The email of the inactive patient
 * @param {string} patientPhone - The phone number of the inactive patient
 * @param {Array} lastDoses - Array of last 5 doses
 * @param {Array} lastReminders - Array of last 3 reminder timestamps
 * @param {Array} adminEmails - Array of admin email addresses
 */
exports.sendInactiveUserNotificationToAdmins = async (
  patientName,
  patientEmail,
  patientPhone,
  lastDoses,
  lastReminders,
  adminEmails
) => {
  const formattedDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Format last doses
  const dosesList = lastDoses.map(dose => 
    `• ${dose.type} - ${new Date(dose.timestamp).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`
  ).join('\n');

  // Format last reminders
  const remindersList = lastReminders.map(reminder => 
    `• ${new Date(reminder).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`
  ).join('\n');

  // Send email to each admin
  for (const adminEmail of adminEmails) {
    try {
      await sendEmailFixed({
        to: adminEmail,
        subject: "⚠️ InsulinLog: User Inactive - No Dose Logging",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">InsulinLog</h1>
              <h2 style="color: white; margin: 10px 0 0 0;">⚠️ User Inactive Alert</h2>
            </div>
            
            <div style="padding: 30px; background-color: white;">
              <p>Hello Admin,</p>
              
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 16px;">
                  A user has become inactive after multiple reminder attempts.
                </p>
              </div>
              
              <h3 style="color: #1f2937;">Patient Details:</h3>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>👤 Name:</strong> ${patientName}</p>
                <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> ${patientEmail}</p>
                <p style="margin: 0 0 10px 0;"><strong>📞 Phone:</strong> ${patientPhone}</p>
              </div>
              
              <h3 style="color: #1f2937;">Last 5 Doses:</h3>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <pre style="margin: 0; white-space: pre-wrap; font-family: Arial, sans-serif;">${dosesList || 'No doses logged'}</pre>
              </div>
              
              <h3 style="color: #1f2937;">Last 3 SMS Reminders:</h3>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <pre style="margin: 0; white-space: pre-wrap; font-family: Arial, sans-serif;">${remindersList || 'No reminders sent'}</pre>
              </div>
              
              <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                  <strong>📅 Alert Date:</strong> ${formattedDate}
                </p>
              </div>
              
              <p><strong>Recommended Actions:</strong></p>
              <ul style="color: #4b5563;">
                <li>Contact the patient directly via phone or email</li>
                <li>Check if there are any technical issues with their account</li>
                <li>Consider manual intervention or account review</li>
                <li>Update patient status in the admin panel</li>
              </ul>
              
              <p>Best regards,<br>The InsulinLog System</p>
            </div>
            
            <div style="background-color: #fee2e2; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #991b1b;">
              This is an automated alert. Please take appropriate action.
            </div>
          </div>
        `,
      });

      console.log(`Inactive user notification sent to admin: ${adminEmail}`);
    } catch (error) {
      console.error(
        `Failed to send inactive user notification to ${adminEmail}:`,
        error.message
      );
      // Continue sending to other admins even if one fails
    }
  }
};