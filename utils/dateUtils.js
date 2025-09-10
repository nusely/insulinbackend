// Date utility functions for consistent date formatting

/**
 * Format a date to DD/MM/YYYY format
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted date string (DD/MM/YYYY)
 */
const formatDate = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format a date to DD/MM/YYYY HH:MM format
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted date string (DD/MM/YYYY HH:MM)
 */
const formatDateTime = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Format a date to DD/MM/YYYY HH:MM:SS format
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted date string (DD/MM/YYYY HH:MM:SS)
 */
const formatDateTimeFull = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  const seconds = dateObj.getSeconds().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Calculate days until expiry
 * @param {Date|string} expiryDate - The expiry date
 * @returns {number} - Days until expiry (negative if expired)
 */
const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return 0;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Get subscription status based on expiry date
 * @param {Date|string} expiryDate - The expiry date
 * @returns {object} - Status object with message and color
 */
const getSubscriptionStatus = (expiryDate) => {
  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
  
  if (daysUntilExpiry < 0) {
    return {
      status: 'expired',
      message: 'Expired',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    };
  } else if (daysUntilExpiry === 0) {
    return {
      status: 'expires-today',
      message: 'Expires Today',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    };
  } else if (daysUntilExpiry <= 7) {
    return {
      status: 'expires-soon',
      message: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    };
  } else {
    return {
      status: 'active',
      message: `Expires in ${daysUntilExpiry} days`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    };
  }
};

/**
 * Format patient data with DD/MM/YYYY dates
 * @param {object} patient - Patient object
 * @returns {object} - Patient object with formatted dates
 */
const formatPatientDates = (patient) => {
  if (!patient) return patient;
  
  const formatted = { ...patient.toObject ? patient.toObject() : patient };
  
  // Format subscription expiry
  if (formatted.subscriptionExpiry) {
    formatted.subscriptionExpiryFormatted = formatDate(formatted.subscriptionExpiry);
  }
  
  // Format last dose time
  if (formatted.lastDoseTime) {
    formatted.lastDoseTimeFormatted = formatDateTime(formatted.lastDoseTime);
  }
  
  // Format last reminder sent
  if (formatted.lastReminderSent) {
    formatted.lastReminderSentFormatted = formatDateTime(formatted.lastReminderSent);
  }
  
  // Format next reminder time
  if (formatted.nextReminderTime) {
    formatted.nextReminderTimeFormatted = formatDateTime(formatted.nextReminderTime);
  }
  
  // Format last activation date
  if (formatted.lastActivationDate) {
    formatted.lastActivationDateFormatted = formatDate(formatted.lastActivationDate);
  }
  
  // Format last subscription renewal
  if (formatted.lastSubscriptionRenewal) {
    formatted.lastSubscriptionRenewalFormatted = formatDate(formatted.lastSubscriptionRenewal);
  }
  
  // Format deactivated at
  if (formatted.deactivatedAt) {
    formatted.deactivatedAtFormatted = formatDateTime(formatted.deactivatedAt);
  }
  
  // Format created date
  if (formatted.date) {
    formatted.dateFormatted = formatDate(formatted.date);
  }
  
  // Add subscription status
  if (formatted.subscriptionExpiry) {
    formatted.subscriptionStatus = getSubscriptionStatus(formatted.subscriptionExpiry);
  }
  
  return formatted;
};

/**
 * Format dose data with DD/MM/YYYY dates
 * @param {object} dose - Dose object
 * @returns {object} - Dose object with formatted dates
 */
const formatDoseDates = (dose) => {
  if (!dose) return dose;
  
  const formatted = { ...dose.toObject ? dose.toObject() : dose };
  
  // Format timestamp
  if (formatted.timestamp) {
    formatted.timestampFormatted = formatDateTime(formatted.timestamp);
  }
  
  // Format created date
  if (formatted.date) {
    formatted.dateFormatted = formatDate(formatted.date);
  }
  
  return formatted;
};

module.exports = {
  formatDate,
  formatDateTime,
  formatDateTimeFull,
  getDaysUntilExpiry,
  getSubscriptionStatus,
  formatPatientDates,
  formatDoseDates
};
