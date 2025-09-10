const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Patient = require("../models/Patient");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { formatPatientDates } = require("../utils/dateUtils");
const { sendWelcomeSMS } = require("../utils/smsService");

// @route   GET /api/patients/
// @desc    Get all patients - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.get(
  "/",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const patients = await Patient.find({ role: "patient" }).select(
        "-password"
      );
      res.json(patients);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   GET /api/patients/:id
// @desc    Get single patient by ID
// @access  Private (Patient (own), Admin, Super Admin)
router.get(
  "/:id",
  protect,
  authorizeRoles(["admin", "superadmin", "patient"]),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id).select("-password");
      if (!patient) {
        return res.status(404).json({ msg: "Patient not found" });
      }
      if (req.user.role === "patient" && req.user.id !== req.params.id) {
        return res.status(403).json({ msg: "Access denied" });
      }
      res.json(patient);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   POST /api/patients
// @desc    Create a new patient - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.post(
  "/",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        gender,
        password,
        subscriptionType,
        subscriptionExpiry,
        active,
        verified,
      } = req.body;

      // Check if patient already exists
      let patient = await Patient.findOne({ email });
      if (patient) {
        return res.status(400).json({ msg: "Patient already exists" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new patient
      patient = new Patient({
        name,
        email,
        phone,
        gender,
        password: hashedPassword,
        role: "patient",
        subscriptionType: subscriptionType || null,
        subscriptionExpiry: subscriptionExpiry || null,
        active: active !== undefined ? active : false,
        verified: verified !== undefined ? verified : false,
      });

      await patient.save();
      console.log(
        `Manual patient created by admin: ${patient.name} (${patient.email}) at ${patient.date}`
      );

      // Send welcome SMS to the patient
      try {
        await sendWelcomeSMS(patient.phone, patient.name);
        console.log(`Welcome SMS sent to ${patient.name} (${patient.phone})`);
      } catch (smsError) {
        console.error(
          `Failed to send welcome SMS to ${patient.name}:`,
          smsError.message
        );
        // Don't fail the patient creation if SMS fails
      }

      res.status(201).json({
        msg: "Patient created successfully",
        patient: {
          _id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          gender: patient.gender,
          role: patient.role,
          subscriptionType: patient.subscriptionType,
          subscriptionExpiry: patient.subscriptionExpiry,
          active: patient.active,
          verified: patient.verified,
          date: patient.date,
        },
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   POST /api/patients/:id/renew-subscription
// @desc    Renew a patient's subscription
// @access  Private (Patient (own), Admin, Super Admin)
router.post(
  "/:id/renew-subscription",
  protect,
  authorizeRoles(["admin", "superadmin", "patient"]),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ msg: "Patient not found" });
      }
      if (req.user.role === "patient" && req.user.id !== req.params.id) {
        return res.status(403).json({ msg: "Access denied" });
      }
      // Determine renewal period
      let days = 30;
      if (patient.subscriptionType === "Yearly") {
        days = 365;
      }
      // Calculate new expiry
      const now = new Date();
      let baseDate = now;
      if (patient.subscriptionExpiry && patient.subscriptionExpiry > now) {
        baseDate = new Date(patient.subscriptionExpiry);
      }
      const newExpiry = new Date(
        baseDate.getTime() + days * 24 * 60 * 60 * 1000
      );
      patient.subscriptionExpiry = newExpiry;
      await patient.save();
      res.json({
        msg: `Subscription renewed for ${days} days.`,
        subscriptionExpiry: patient.subscriptionExpiry,
      });
    } catch (err) {
      console.error("Renewal error:", err.message);
      res.status(500).send("Server Error during renewal.");
    }
  }
);

// @route   PATCH /api/patients/:id/toggle-active
// @desc    Toggle patient active status with deactivation reasons - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.patch(
  "/:id/toggle-active",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);
      const { deactivationReason, deactivationNotes } = req.body;

      if (!patient) {
        return res.status(404).json({ msg: "Patient not found" });
      }

      // Prevent Admins from deactivating Super Admins
      if (req.user.role === "admin" && patient.role === "superadmin") {
        return res.status(403).json({
          msg: "Access denied. Admins cannot modify Super Admin status.",
        });
      }

      const previousActiveState = patient.active;
      const isDeactivating = previousActiveState && !patient.active;
      const isReactivating = !previousActiveState && patient.active;
      
      patient.active = !patient.active; // Toggle the active status
      
      // Track reactivation (active changed from false to true)
      if (!previousActiveState && patient.active) {
        patient.lastActivationDate = new Date();
        patient.previousActiveState = previousActiveState;
        
        // 🔧 FIX: Update subscription expiry when admin activates user after payment
        if (patient.subscriptionExpiry) {
          const now = new Date();
          let baseDate = now;
          
          // If current expiry is in the future, extend from that date
          if (patient.subscriptionExpiry > now) {
            baseDate = new Date(patient.subscriptionExpiry);
          }
          
          // Determine renewal period based on subscription type
          let days = 30; // Default to monthly
          if (patient.subscriptionType === "Yearly") {
            days = 365;
          }
          
          // Calculate new expiry date
          const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
          const previousExpiry = patient.subscriptionExpiry;
          patient.subscriptionExpiry = newExpiry;
          
          // Track renewal history
          patient.subscriptionRenewalCount = (patient.subscriptionRenewalCount || 0) + 1;
          patient.lastSubscriptionRenewal = new Date();
          
          // Add to renewal history
          if (!patient.subscriptionRenewalHistory) {
            patient.subscriptionRenewalHistory = [];
          }
          
          patient.subscriptionRenewalHistory.push({
            renewedAt: new Date(),
            renewedBy: req.user.role, // 'admin' or 'superadmin'
            previousExpiry: previousExpiry,
            newExpiry: newExpiry,
            subscriptionType: patient.subscriptionType,
          });
          
          console.log(`🔄 Subscription renewed for ${patient.name}: ${days} days from ${baseDate.toISOString()} to ${newExpiry.toISOString()}`);
          console.log(`📊 Renewal count: ${patient.subscriptionRenewalCount}, renewed by: ${req.user.role}`);
        }
        
        // Handle smart reactivation immediately
        try {
          const { sendSmartReactivationSMS } = require("../utils/smsService");
          const sendEmailFixed = require("../utils/sendEmailFixed");
          
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
          
          // Send reactivation email
          try {
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            const loginUrl = `${frontendUrl}/login`;
            
            await sendEmailFixed({
              to: patient.email,
              subject: "🎉 InsulinLog: Account Reactivated - Welcome Back!",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0;">InsulinLog</h1>
                    <h2 style="color: white; margin: 10px 0 0 0;">🎉 Account Reactivated</h2>
                  </div>
                  
                  <div style="padding: 30px; background-color: white;">
                    <p>Hello ${patient.name},</p>
                    
                    <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
                      <p style="margin: 0; font-weight: bold; color: #065f46; font-size: 16px;">
                        Great news! Your InsulinLog account has been reactivated.
                      </p>
                    </div>
                    
                    ${subscriptionExpired ? 
                      `<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: bold; color: #dc2626; font-size: 16px;">
                          ⚠️ Subscription Expired
                        </p>
                        <p style="margin: 5px 0 0 0; color: #7f1d1d;">
                          Your subscription expired on ${patient.subscriptionExpiry ? new Date(patient.subscriptionExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Unknown'}. Please contact admin to renew before logging doses.
                        </p>
                      </div>` :
                      `<div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: bold; color: #065f46; font-size: 16px;">
                          ✅ Subscription Active
                        </p>
                        <p style="margin: 5px 0 0 0; color: #064e3b;">
                          Your subscription is active until ${patient.subscriptionExpiry ? new Date(patient.subscriptionExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Unknown'}.
                        </p>
                      </div>`
                    }
                    
                    <p>We're excited to have you back on your health journey! Your account is now active and ready to use.</p>
                    
                    <h3 style="color: #1f2937;">What's Next?</h3>
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      ${subscriptionExpired ? 
                        `<p style="margin: 0 0 10px 0;"><strong>1. Contact Admin:</strong> Email support@insulinlog.com to renew your subscription</p>
                         <p style="margin: 0 0 10px 0;"><strong>2. Wait for Confirmation:</strong> Admin will reactivate your subscription</p>
                         <p style="margin: 0;"><strong>3. Log In:</strong> Once renewed, <a href="${loginUrl}" style="color: #2563eb;">click here to log in</a></p>` :
                        `<p style="margin: 0 0 10px 0;"><strong>1. Log In:</strong> <a href="${loginUrl}" style="color: #2563eb;">Click here to log in</a></p>
                         <p style="margin: 0 0 10px 0;"><strong>2. Take Your First Dose:</strong> Log your insulin dose to get back on track</p>
                         <p style="margin: 0;"><strong>3. Stay Consistent:</strong> You'll receive helpful reminders to maintain your routine</p>`
                      }
                    </div>
                    
                    <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; color: #92400e;">
                        <strong>📱 SMS Notification:</strong> You should also receive a welcome back SMS message shortly.
                      </p>
                    </div>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    
                    <p>Welcome back to your health journey!<br>The CimonsTech Team</p>
                  </div>
                  
                  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;">
                    This is an automated notification. Please do not reply to this email.
                  </div>
                </div>
              `,
            });
            
            console.log(`Reactivation email sent to ${patient.email}`);
          } catch (emailError) {
            console.error(`Failed to send reactivation email to ${patient.email}:`, emailError.message);
          }
          
          // Reset SMS cycle to new_user to encourage first dose logging
          patient.smsReminderCycle = 'new_user';
          patient.hasLoggedFirstDose = false;
          patient.reminderAttempts = 0;
          patient.lastReminderSent = null;
          patient.nextReminderTime = null;
          
        } catch (error) {
          console.error("Error handling immediate reactivation:", error);
        }
      }
      
      // Handle manual deactivation (active changed from true to false)
      if (isDeactivating) {
        // Validate deactivation reason for manual deactivation
        if (!deactivationReason || !deactivationReason.startsWith('Manual deactivation')) {
          return res.status(400).json({ 
            msg: "Deactivation reason is required for manual deactivation. Please provide a valid reason." 
          });
        }
        
        // Set deactivation tracking fields
        patient.deactivatedAt = new Date();
        patient.deactivationReason = deactivationReason;
        patient.deactivatedBy = req.user.id; // Admin/SuperAdmin ID
        patient.deactivationNotes = deactivationNotes || null;
        patient.previousActiveState = previousActiveState;
        
        // Send deactivation notification SMS
        try {
          const { sendManualDeactivationNotificationSMS } = require("../utils/smsService");
          
          const smsResult = await sendManualDeactivationNotificationSMS(
            patient.phone, 
            patient.name, 
            deactivationReason
          );
          
          if (smsResult.success) {
            console.log(`Manual deactivation notification SMS sent to ${patient.name} (${patient.phone})`);
          } else {
            console.error(`Failed to send deactivation SMS to ${patient.phone}:`, smsResult.error);
          }
        } catch (error) {
          console.error("Error sending deactivation notification:", error);
        }
        
        console.log(`User ${patient.name} manually deactivated by ${req.user.role} (${req.user.id}) - Reason: ${deactivationReason}`);
      }
      
      await patient.save();

      res.json({
        msg: `Patient status updated to ${
          patient.active ? "active" : "inactive"
        }${!previousActiveState && patient.active && patient.subscriptionExpiry ? ' - Subscription renewed' : ''}`,
        patient: formatPatientDates(patient),
      });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid patient ID format." });
      }
      res.status(500).send("Server Error");
    }
  }
);

// @route   POST /api/patients/:id/send-reminder
// @desc    Send manual reminder to a patient - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.post(
  "/:id/send-reminder",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({ msg: "Patient not found" });
      }

      // Here you would integrate with your email/SMS service
      // For now, just log the reminder
      console.log(
        `Manual reminder sent to: ${patient.name} (${patient.email})`
      );

      res.json({
        msg: `Manual reminder sent to ${patient.name} (${patient.email}).`,
      });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid patient ID format." });
      }
      res.status(500).send("Server Error");
    }
  }
);

// @route   DELETE /api/patients/:id
// @desc    Delete a patient - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.delete(
  "/:id",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({ msg: "Patient not found" });
      }

      // Prevent Admins from deleting Super Admins
      if (req.user.role === "admin" && patient.role === "superadmin") {
        return res.status(403).json({
          msg: "Access denied. Admins cannot delete Super Admin accounts.",
        });
      }

      // Soft delete the patient instead of hard delete
      await Patient.findByIdAndUpdate(req.params.id, {
        isActive: false,
        deletedAt: new Date(),
      });

      res.status(200).json({
        msg: `Patient ${patient.name} has been successfully soft-deleted.`,
      });
    } catch (err) {
      console.error("Delete patient error:", err.message);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid patient ID format." });
      }
      res.status(500).json({ msg: "Server Error" });
    }
  }
);

module.exports = router;
