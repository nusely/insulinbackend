// backend/routes/auth.js

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController"); // Import the auth controller
const { protect } = require("../middleware/authMiddleware"); // Import the protect middleware
const { 
  validateUserRegistration, 
  validateUserLogin, 
  validatePasswordReset, 
  validateNewPassword,
  handleValidationErrors 
} = require("../middleware/validation/doseValidation");

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", validateUserRegistration, handleValidationErrors, authController.registerUser);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", authController.loginUser);

// @route   GET /api/auth/verify-email/:token
// @desc    Verify user's email address
// @access  Public
router.get("/verify-email/:token", authController.verifyEmail);

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification link
// @access  Public
router.post("/resend-verification", authController.resendVerificationEmail);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset link
// @access  Public
router.post("/forgot-password", validatePasswordReset, handleValidationErrors, authController.forgotPassword);

// @route   PUT /api/auth/reset-password/:token
// @desc    Reset user's password
// @access  Public
router.put("/reset-password/:token", validateNewPassword, handleValidationErrors, authController.resetPassword);

// @route   GET /api/auth/me
// @desc    Get current authenticated user's profile
// @access  Private (Requires JWT)
router.get("/me", protect, authController.getMe); // Now protected by the 'protect' middleware

module.exports = router;
