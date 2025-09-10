// backend/controllers/authController.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // Node.js built-in module for cryptographic functionality

const Patient = require("../models/Patient");
const Admin = require("../models/Admin"); // For admin users
const Token = require("../models/Token"); // Import the new Token model
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNewRegistrationNotificationToAdmins,
} = require("../utils/emailService"); // We'll create this next
const { sendWelcomeSMS } = require("../utils/smsService");

/**
 * @function generateToken
 * @description Generates a JWT for a user.
 * @param {object} user - The user object.
 * @returns {string} The generated JWT.
 */
const generateToken = (user) => {
  // Sign the JWT with user ID and role, and a secret from environment variables
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_LIFETIME || "1d" } // Token expires in 1 day by default
  );
};

/**
 * @function registerUser
 * @description Handles user registration.
 * @route POST /api/auth/register
 * @access Public
 */
exports.registerUser = async (req, res) => {
  const { name, email, phone, gender, password, subscriptionType } = req.body;

  try {
    // 1. Check if user already exists
    let patient = await Patient.findOne({ email });
    if (patient) {
      return res
        .status(400)
        .json({ msg: "patient with this email already exists." });
    }

    // Validate subscription type
    if (
      !subscriptionType ||
      !["Monthly", "Yearly"].includes(subscriptionType)
    ) {
      return res.status(400).json({
        msg: "Invalid subscription type. Must be either 'Monthly' or 'Yearly'.",
      });
    }

    // 2. Calculate subscription expiry based on subscription type
    let subscriptionExpiry;
    const now = new Date();

    if (subscriptionType === "Monthly") {
      // Add 1 month
      subscriptionExpiry = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate()
      );
    } else if (subscriptionType === "Yearly") {
      // Add 1 year
      subscriptionExpiry = new Date(
        now.getFullYear() + 1,
        now.getMonth(),
        now.getDate()
      );
    }

    // 3. Create new patient instance
    patient = new Patient({
      name,
      email,
      phone,
      gender,
      password,
      subscriptionType,
      subscriptionExpiry,
      active: false, // Inactive by default
      verified: false, // Unverified by default
    });

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    patient.password = await bcrypt.hash(password, salt);

    // 5. Save user to database
    await patient.save();

    // 6. Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const newToken = new Token({
      userId: patient._id,
      token: verificationToken,
      type: "emailVerification",
      expiresAt: new Date(Date.now() + 3600000), // Token valid for 1 hour
    });
    await newToken.save();

    // 7. Send verification email with request context
    await sendVerificationEmail(patient.email, verificationToken, req);

    // 8. Send notification to all admins about the new registration
    try {
      // Get all admin email addresses
      const admins = await Admin.find({ active: true }).select("email");
      const adminEmails = admins.map((admin) => admin.email);

      if (adminEmails.length > 0) {
        await sendNewRegistrationNotificationToAdmins(
          patient.name,
          patient.email,
          patient.phone,
          patient.gender,
          patient.subscriptionType,
          adminEmails
        );
        console.log(
          `New registration notification sent to ${adminEmails.length} admin(s)`
        );
      } else {
        console.log("No active admins found to notify about new registration");
      }
    } catch (emailError) {
      console.error(
        "Failed to send admin notification email:",
        emailError.message
      );
      // Don't fail the registration if admin notification fails
    }

    res.status(201).json({
      msg: "patient registered successfully. Please check your email for a verification link.",
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        role: patient.role,
        active: patient.active,
        verified: patient.verified,
      },
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).send("Server Error during registration.");
  }
};

/**
 * @function loginUser
 * @description Handles user login.
 * @route POST /api/auth/login
 * @access Public
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if user exists in Patient collection first
    let user = await Patient.findOne({ email });

    let isAdmin = false;

    // If not found in Patient collection, check Admin collection for admin users
    if (!user) {
      user = await Admin.findOne({ email });
      if (user && (user.role === "admin" || user.role === "superadmin")) {
        isAdmin = true;
      }
    }

    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials." });
    }

    // 2. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials." });
    }

    // 3. Check if user is verified (skip for admin users as they might not need email verification)
    if (!isAdmin && !user.verified) {
      return res
        .status(403)
        .json({ msg: "Please verify your email to log in." });
    }

    // 4. Check if user is active (admin approval)
    if (!user.active) {
      return res.status(403).json({
        msg: "Your account is pending activation by an administrator.",
      });
    }

    // 5. Check if user has been soft deleted
    if (user.isActive === false) {
      return res.status(403).json({
        msg: "This account has been deactivated. Please contact support for assistance.",
      });
    }

    // 5. Generate JWT
    const token = generateToken(user);

    res.json({
      msg: "Login successful.",
      token,
      patient: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        verified: user.verified,
        subscriptionType: user.subscriptionType,
        subscriptionExpiry: user.subscriptionExpiry,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);

    // Check if it's a MongoDB connection error
    if (
      err.message.includes("ENOTFOUND") ||
      err.message.includes("ECONNREFUSED")
    ) {
      return res
        .status(503)
        .json({ msg: "Database connection error. Please try again later." });
    }

    res.status(500).json({ msg: "Server Error during login." });
  }
};

/**
 * @function verifyEmail
 * @description Verifies a user's email using a token.
 * @route GET /api/auth/verify-email/:token
 * @access Public
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    // 1. Find the token
    const verificationToken = await Token.findOne({
      token,
      type: "emailVerification",
      expiresAt: { $gt: Date.now() }, // Token must not be expired
    });

    if (!verificationToken) {
      return res
        .status(400)
        .json({ msg: "Invalid or expired verification link." });
    }

    // 2. Find the patient associated with the token
    const patient = await Patient.findById(verificationToken.userId);
    if (!patient) {
      return res.status(404).json({ msg: "Patient not found." });
    }

    // 3. Mark patient as verified and active
    patient.verified = true;
    patient.active = true; // Activate the account
    await patient.save();

    // 4. Send welcome SMS now that account is active
    try {
      const smsResult = await sendWelcomeSMS(patient.phone, patient.name);
      if (smsResult.success) {
        // Update patient record to mark welcome SMS as sent
        patient.welcomeSmsSent = true;
        patient.welcomeSmsSentAt = new Date();
        patient.lastActivationDate = new Date();
        await patient.save();
        console.log(`Welcome SMS sent successfully to ${patient.phone}`);
      } else {
        console.error(
          `Failed to send welcome SMS to ${patient.phone}:`,
          smsResult.error
        );
      }
    } catch (smsError) {
      console.error("Error sending welcome SMS:", smsError.message);
      // Don't fail verification if SMS fails
    }

    // 5. Delete the used token
    await verificationToken.deleteOne();

    res.status(200).json({
      msg: "Email verified successfully. You can now log in. Welcome SMS sent!",
    });
  } catch (err) {
    console.error("Email verification error:", err.message);
    res.status(500).send("Server Error during email verification.");
  }
};

/**
 * @function forgotPassword
 * @description Initiates the password reset process by sending a reset link.
 * @route POST /api/auth/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Find the patient by email
    const patient = await Patient.findOne({ email });
    if (!patient) {
      // Send a generic success message to prevent email enumeration
      return res.status(200).json({
        msg: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // 2. Delete any existing password reset tokens for this patient
    await Token.deleteMany({ userId: patient._id, type: "passwordReset" });

    // 3. Generate a new password reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const newToken = new Token({
      userId: patient._id,
      token: resetToken,
      type: "passwordReset",
      expiresAt: new Date(Date.now() + 3600000), // Token valid for 1 hour
    });
    await newToken.save();

    // 4. Send password reset email
    await sendPasswordResetEmail(patient.email, resetToken);

    res.status(200).json({
      msg: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).send("Server Error during forgot password process.");
  }
};

/**
 * @function resetPassword
 * @description Resets the user's password using a valid token.
 * @route PUT /api/auth/reset-password/:token
 * @access Public
 */
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    // 1. Find the token
    const resetToken = await Token.findOne({
      token,
      type: "passwordReset",
      expiresAt: { $gt: Date.now() }, // Token must not be expired
    });

    if (!resetToken) {
      return res
        .status(400)
        .json({ msg: "Invalid or expired password reset link." });
    }

    // 2. Find the patient associated with the token
    const patient = await Patient.findById(resetToken.userId);
    if (!patient) {
      return res.status(404).json({ msg: "Patient not found." });
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    patient.password = await bcrypt.hash(newPassword, salt);
    await patient.save();

    // 4. Delete the used token
    await resetToken.deleteOne();

    res.status(200).json({ msg: "Password has been reset successfully." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).send("Server Error during password reset.");
  }
};

/**
 * @function resendVerificationEmail
 * @description Resends email verification link to a user.
 * @route POST /api/auth/resend-verification
 * @access Public
 */
exports.resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Find the patient by email
    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res.status(404).json({ msg: "User not found." });
    }

    // 2. Check if already verified
    if (patient.verified) {
      return res.status(400).json({ msg: "Email is already verified." });
    }

    // 3. Delete any existing verification tokens for this patient
    await Token.deleteMany({ userId: patient._id, type: "emailVerification" });

    // 4. Generate a new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const newToken = new Token({
      userId: patient._id,
      token: verificationToken,
      type: "emailVerification",
      expiresAt: new Date(Date.now() + 3600000), // Token valid for 1 hour
    });
    await newToken.save();

    // 5. Send verification email with request context
    try {
      await sendVerificationEmail(patient.email, verificationToken, req);
      console.log(
        `Verification email resent successfully to: ${patient.email}`
      );

      res.status(200).json({
        msg: "Verification email sent successfully. Please check your inbox.",
      });
    } catch (emailError) {
      console.error("Email sending failed during resend:", emailError.message);

      // Still return success to user but log the error
      res.status(200).json({
        msg: "Verification request processed. If you don't receive an email, please contact support.",
        emailSent: false,
      });
    }
  } catch (err) {
    console.error("Resend verification error:", err.message);
    res.status(500).json({
      msg: "Server Error during resend verification.",
      error: err.message,
    });
  }
};

/**
 * @function getMe
 * @description Gets the currently authenticated user's profile.
 * @route GET /api/auth/me
 * @access Private (Requires JWT)
 */
exports.getMe = async (req, res) => {
  try {
    // req.user is populated by the authMiddleware
    // First check Patient collection
    let user = await Patient.findById(req.user.id).select("-password");

    // If not found in Patient collection, check Admin collection for admin users
    if (!user) {
      user = await Admin.findById(req.user.id).select("-password");
    }

    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    res.json(user);
  } catch (err) {
    console.error("Get me error:", err.message);
    res.status(500).send("Server Error fetching user data.");
  }
};
