// backend/utils/smsService.js

const axios = require("axios");

/**
 * @function sendSMS
 * @description Sends SMS using Fish Africa API
 * @param {string} phoneNumber - The recipient's phone number
 * @param {string} message - The SMS message content
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendSMS = async (phoneNumber, message) => {
  try {
    // Check if SMS is enabled
    if (process.env.SMS_ENABLED === "false") {
      console.log(
        "SMS is disabled in environment. Would have sent:",
        message,
        "to:",
        phoneNumber
      );
      return {
        success: true,
        messageId: "disabled",
        response: { message: "SMS disabled in environment" },
      };
    }

    // Format phone number (remove any spaces, dashes, or plus signs)
    const formattedPhone = phoneNumber.replace(/[\s\-\+]/g, "");

    // Ensure phone number starts with country code (Ghana: 233)
    let finalPhone = formattedPhone;
    if (formattedPhone.startsWith("0")) {
      finalPhone = "233" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("233")) {
      finalPhone = "233" + formattedPhone;
    }

    console.log(`Sending SMS to: ${finalPhone}`);
    console.log(`Message: ${message}`);

    // Fish Africa API configuration
    const fishAfricaApiUrl = process.env.FISH_AFRICA_API_URL || "https://api.letsfish.africa/v1/sms";
    const appId = process.env.FISH_AFRICA_APP_ID;
    const appSecret = process.env.FISH_AFRICA_APP_SECRET;
    const senderId = process.env.FISH_AFRICA_SENDER_ID || "CimonsTech";

    if (!appId || !appSecret) {
      throw new Error("Fish Africa API credentials not configured");
    }

    // Create Bearer token for authentication
    const bearerToken = `${appId}.${appSecret}`;

    // Prepare request payload
    const payload = {
      sender_id: senderId,
      message: message,
      recipients: [finalPhone]
    };

    console.log("Fish Africa API Request:", {
      url: fishAfricaApiUrl,
      sender_id: senderId,
      recipients: [finalPhone],
      message_length: message.length
    });

    // Make API request
    const timeout = parseInt(process.env.FISH_AFRICA_TIMEOUT) || 30000; // Default 30 seconds
    const response = await axios.post(fishAfricaApiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      timeout: timeout
    });

    console.log("Fish Africa API Response:", response.data);

    // Check if SMS was sent successfully
    // Fish Africa API returns 202 (Accepted) for successful requests
    if (response.status === 200 || response.status === 201 || response.status === 202) {
      console.log("SMS sent successfully via Fish Africa");
      return {
        success: true,
        messageId: response.data.data?.[0]?.reference || response.data.message_id || response.data.id || "unknown",
        response: response.data,
        provider: "Fish Africa"
      };
    } else {
      console.error("SMS sending failed:", response.data);
      return {
        success: false,
        error: response.data?.message || response.data?.error || "Unknown error",
        response: response.data,
        provider: "Fish Africa"
      };
    }
  } catch (error) {
    console.error("Error sending SMS via Fish Africa:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return {
      success: false,
      error: error.message,
      apiResponse: error.response?.data,
      provider: "Fish Africa"
    };
  }
};

/**
 * @function sendWelcomeSMS
 * @description Sends welcome SMS to new patients
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendWelcomeSMS = async (phoneNumber, patientName) => {
  const welcomeMessage = `Welcome to InsulinLog, ${patientName}! 🎉\nYour account has been created successfully.\nYou'll now receive timely reminders to help you stay on track with your insulin doses.\n\nTogether, let's make diabetes management easier.\n\n– CimonsTech`;

  return await exports.sendSMS(phoneNumber, welcomeMessage);
};

/**
 * @function sendDoseReminderSMS
 * @description Sends dose reminder SMS to patients with login URL
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @param {number} attemptNumber - Reminder attempt number (1 or 2)
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendDoseReminderSMS = async (
  phoneNumber,
  patientName,
  attemptNumber = 1
) => {
  // Get the frontend URL from environment variables
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${frontendUrl}/login`;

  let reminderMessage;

  if (attemptNumber === 1) {
    reminderMessage = `Hi ${patientName}, it's time for your insulin dose reminder! 💊\n\nPlease log your dose in the InsulinLog app to maintain your health routine.\n\n🔗 Quick Login: ${loginUrl}\n\nStay healthy! 🌟\n- CimonsTech`;
  } else {
    reminderMessage = `Hi ${patientName}, this is your second reminder! ⚠️\n\nYou haven't logged your insulin dose yet. Please take your dose and log it immediately.\n\n🔗 Login here: ${loginUrl}\n\nYour health matters! 💙\n- CimonsTech`;
  }

  return await exports.sendSMS(phoneNumber, reminderMessage);
};

/**
 * @function sendNewUserReminderSMS
 * @description Sends reminder SMS to new users who haven't logged their first dose
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @param {number} attemptNumber - Reminder attempt number (1 or 2)
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendNewUserReminderSMS = async (
  phoneNumber,
  patientName,
  attemptNumber = 1
) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${frontendUrl}/login`;

  const reminderMessage = `Hello ${patientName}, you have not logged a dose yet, kindly log in at ${loginUrl} and log your first dose.\n\nStart your health journey with InsulinLog today!\n\n– CimonsTech`;

  return await exports.sendSMS(phoneNumber, reminderMessage);
};

/**
 * @function sendReactivationSMS
 * @description Sends reactivation SMS to users whose accounts have been reactivated
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendReactivationSMS = async (phoneNumber, patientName) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${frontendUrl}/login`;

  const reactivationMessage = `Welcome back to InsulinLog, ${patientName}! 🎉\nYour account has been reactivated.\n\nPlease log in and take your first dose: ${loginUrl}\n\nWe're here to support your health journey!\n\n– CimonsTech`;

  return await exports.sendSMS(phoneNumber, reactivationMessage);
};

/**
 * @function sendThirdReminderSMS
 * @description Sends third and final reminder SMS to active users
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendThirdReminderSMS = async (phoneNumber, patientName) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${frontendUrl}/login`;

  const reminderMessage = `Hi ${patientName}, this is your final reminder! ⚠️\n\nYou haven't logged your insulin dose yet. Please take your dose and log it immediately.\n\n🔗 Login here: ${loginUrl}\n\nYour health is our priority! 💙\n- CimonsTech`;

  return await exports.sendSMS(phoneNumber, reminderMessage);
};

/**
 * @function sendSmartReactivationSMS
 * @description Sends smart reactivation SMS based on subscription status
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @param {boolean} subscriptionExpired - Whether subscription has expired
 * @param {string} deactivationReason - Reason for deactivation
 * @param {Object} patient - Patient object with subscription details
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendSmartReactivationSMS = async (phoneNumber, patientName, subscriptionExpired, deactivationReason, patient = null) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${frontendUrl}/login`;
  
  let reactivationMessage;
  
  if (subscriptionExpired) {
    // Format expiry date for display
    const expiryDate = patient?.subscriptionExpiry ? 
      new Date(patient.subscriptionExpiry).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      }) : 'Unknown';
    
    // Subscription expired - need to renew
    reactivationMessage = `Welcome back to InsulinLog, ${patientName}! 🎉\n\nYour account has been reactivated, but your subscription expired on ${expiryDate}.\n\nPlease contact admin to renew your subscription before logging doses.\n\n📞 Contact: support@insulinlog.com\n\nWe're here to support your health journey!\n\n– CimonsTech`;
  } else {
    // Format expiry date for display
    const expiryDate = patient?.subscriptionExpiry ? 
      new Date(patient.subscriptionExpiry).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      }) : 'Unknown';
    
    // Subscription still active - normal welcome with expiry info
    reactivationMessage = `Welcome back to InsulinLog, ${patientName}! 🎉\n\nYour account has been reactivated and your subscription is active until ${expiryDate}.\n\nPlease log in and take your first dose: ${loginUrl}\n\nWe're here to support your health journey!\n\n– CimonsTech`;
  }

  return await exports.sendSMS(phoneNumber, reactivationMessage);
};

/**
 * @function sendManualDeactivationNotificationSMS
 * @description Sends notification SMS when user is manually deactivated
 * @param {string} phoneNumber - Patient's phone number
 * @param {string} patientName - Patient's name
 * @param {string} deactivationReason - Reason for deactivation
 * @returns {Promise<Object>} - SMS sending result
 */
exports.sendManualDeactivationNotificationSMS = async (phoneNumber, patientName, deactivationReason) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const contactUrl = `${frontendUrl}/contact`;
  
  let notificationMessage;
  
  switch (deactivationReason) {
    case "Manual deactivation - Medical reasons":
      notificationMessage = `Hello ${patientName},\n\nYour InsulinLog account has been temporarily deactivated for medical reasons.\n\nIf you have any questions, please contact us: ${contactUrl}\n\nWe're here to support your health journey.\n\n– CimonsTech`;
      break;
    case "Manual deactivation - Cost":
      notificationMessage = `Hello ${patientName},\n\nYour InsulinLog account has been deactivated due to cost concerns.\n\nWe understand financial constraints. Please contact us to discuss options: ${contactUrl}\n\nWe're here to support your health journey.\n\n– CimonsTech`;
      break;
    case "Manual deactivation - User request":
      notificationMessage = `Hello ${patientName},\n\nYour InsulinLog account has been deactivated as requested.\n\nYou can reactivate anytime by contacting us: ${contactUrl}\n\nWe're here to support your health journey.\n\n– CimonsTech`;
      break;
    default:
      notificationMessage = `Hello ${patientName},\n\nYour InsulinLog account has been temporarily deactivated.\n\nIf you have any questions, please contact us: ${contactUrl}\n\nWe're here to support your health journey.\n\n– CimonsTech`;
  }

  return await exports.sendSMS(phoneNumber, notificationMessage);
};
