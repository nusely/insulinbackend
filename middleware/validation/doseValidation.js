const { body, validationResult } = require('express-validator');

// Validation rules for dose logging
const validateDoseLogging = [
  body('doseType')
    .notEmpty()
    .withMessage('Dose type is required')
    .isIn(['Basal', 'Bolus', 'Correction'])
    .withMessage('Dose type must be one of: Basal, Bolus, Correction'),
  
  body('doseAmount')
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Dose amount must be between 0.1 and 100 units'),
  
  body('timestamp')
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO 8601 date')
    .custom((value) => {
      const doseTime = new Date(value);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      if (doseTime < oneHourAgo) {
        throw new Error('Dose time cannot be more than 1 hour in the past');
      }
      if (doseTime > oneHourFromNow) {
        throw new Error('Dose time cannot be more than 1 hour in the future');
      }
      return true;
    }),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Validation rules for user registration
const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .matches(/^(\+233|0)[0-9]{9}$/)
    .withMessage('Please provide a valid Ghana phone number (e.g., 0553018172 or +233553018172)'),
  
  body('gender')
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('subscriptionType')
    .isIn(['Monthly', 'Yearly'])
    .withMessage('Subscription type must be Monthly or Yearly')
];

// Validation rules for user login
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validation rules for password reset
const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Validation rules for new password
const validateNewPassword = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
];

// Validation rules for admin user creation
const validateAdminCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .matches(/^(\+233|0)[0-9]{9}$/)
    .withMessage('Please provide a valid Ghana phone number'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('role')
    .isIn(['admin', 'superadmin'])
    .withMessage('Role must be admin or superadmin'),
  
  body('gender')
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other')
];

// Middleware to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  next();
};

// Custom validation for duplicate dose checking
const checkDuplicateDose = async (req, res, next) => {
  try {
    const { timestamp, doseType } = req.body;
    const userId = req.user.id;
    
    // Import Dose model
    const Dose = require('../../models/Dose');
    
    const doseTime = new Date(timestamp);
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    
    const existingDose = await Dose.findOne({
      patient: userId,
      doseType: doseType,
      timestamp: {
        $gte: new Date(doseTime.getTime() - timeWindow),
        $lte: new Date(doseTime.getTime() + timeWindow)
      }
    });
    
    if (existingDose) {
      return res.status(400).json({
        success: false,
        message: 'A dose of this type has already been logged within 15 minutes of this time',
        error: 'DUPLICATE_DOSE'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking for duplicate dose:', error);
    next(); // Continue if check fails
  }
};

// Custom validation for subscription status
const checkSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Import Patient model
    const Patient = require('../../models/Patient');
    
    const patient = await Patient.findById(userId);
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // Check if subscription is expired
    if (patient.subscriptionExpiry && new Date() > new Date(patient.subscriptionExpiry)) {
      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please contact support to renew.',
        error: 'SUBSCRIPTION_EXPIRED'
      });
    }
    
    // Check if user is active
    if (!patient.active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact support.',
        error: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Check if email is verified
    if (!patient.verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging doses.',
        error: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    next(); // Continue if check fails
  }
};

module.exports = {
  validateDoseLogging,
  validateUserRegistration,
  validateUserLogin,
  validatePasswordReset,
  validateNewPassword,
  validateAdminCreation,
  handleValidationErrors,
  checkDuplicateDose,
  checkSubscriptionStatus
};
