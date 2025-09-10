// backend/routes/users.js

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // Still needed for password hashing in register (if kept here)
const Patient = require("../models/Patient"); // Use Patient model instead of User

// Import middleware
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// IMPORTANT: Static routes must come BEFORE parameterized routes
// Simple test route to verify API is working - NO AUTH NEEDED
router.get("/test", (req, res) => {
  res.json({ msg: "Users API is working" });
});

// @route   PUT /api/users/update-profile/:id
// @desc    Update user contact information (email or phone)
// @access  Private (Own user or Admin/SuperAdmin)
router.put(
  "/update-profile/:id",
  protect,
  authorizeRoles(["patient", "admin", "superadmin"]),
  async (req, res) => {
    try {
      console.log(`Update profile request for user ID: ${req.params.id}`);
      console.log(`Request body:`, req.body);

      const { email, phone } = req.body;

      // Validate inputs
      if (!email && !phone) {
        return res.status(400).json({
          msg: "Either email or phone is required for update",
        });
      }

      // Email validation
      if (email && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        return res
          .status(400)
          .json({ msg: "Please provide a valid email address" });
      }

      // Phone validation (accept simple 10-digit format for Ghana numbers)
      if (phone && !/^\d{10}$/.test(phone)) {
        return res
          .status(400)
          .json({ msg: "Please provide a valid phone number (10 digits)" });
      }

      // Validate MongoDB ID format
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ msg: "Invalid user ID format" });
      }

      const user = await Patient.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      // Ensure users can only update their own profile unless admin/superadmin
      if (req.user.role === "patient" && req.user.id !== req.params.id) {
        return res.status(403).json({
          msg: "Access denied. You can only update your own contact information.",
        });
      }

      // Check if email is already taken (if updating email)
      if (email && email !== user.email) {
        const emailExists = await Patient.findOne({ email });
        if (emailExists) {
          return res.status(400).json({ msg: "Email is already in use" });
        }
        user.email = email;
      }

      // Update phone if provided
      if (phone) {
        console.log("Saving phone number:", phone);
        user.phone = phone;
      }

      await user.save();

      // Return updated user (exclude password)
      const updatedUser = await Patient.findById(req.params.id).select(
        "-password"
      );

      res.json({
        msg: "Contact information updated successfully",
        user: updatedUser,
      });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid user ID format." });
      }
      res.status(500).send("Server Error");
    }
  }
);

// @route   POST /api/users/register
// @desc    Register a new user (This route will eventually be moved to /api/auth/register)
//          Keeping it here for now as per your original file, but authController handles it.
// @access  Public
router.post("/register", async (req, res) => {
  // This logic is now handled by authController.registerUser
  // This route might become redundant or serve a different purpose later.
  // For now, it's just a placeholder or can be removed if authController.registerUser is the definitive one.
  res
    .status(400)
    .json({ msg: "Please use /api/auth/register for user registration." });
});

// @route   GET /api/users/
// @desc    Get all users (patients) - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.get(
  "/",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const users = await Patient.find({ role: "patient" }).select("-password"); // Get only patients, exclude password
      res.json(users);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   GET /api/users/:id
// @desc    Get single user by ID (Patient can get own, Admin/Super Admin can get any patient)
// @access  Private (Patient (own), Admin, Super Admin)
router.get(
  "/:id",
  protect,
  authorizeRoles(["admin", "superadmin", "patient"]), // Patient can access own profile
  async (req, res) => {
    try {
      const user = await Patient.findById(req.params.id).select("-password");

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      // If user is a Patient, ensure they can only access their own profile
      if (req.user.role === "patient" && req.user.id !== req.params.id) {
        return res
          .status(403)
          .json({ msg: "Access denied. You can only view your own profile." });
      }

      res.json(user);
    } catch (err) {
      console.error(err.message);
      // Check for CastError (invalid ID format)
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid user ID format." });
      }
      res.status(500).send("Server Error");
    }
  }
);

// @route   PUT /api/users/:id/toggle-status
// @desc    Toggle user active status - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.put(
  "/:id/toggle-status",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const user = await Patient.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      // Prevent Admins from deactivating Super Admins
      if (req.user.role === "admin" && user.role === "superadmin") {
        return res.status(403).json({
          msg: "Access denied. Admins cannot modify Super Admin status.",
        });
      }

      user.active = !user.active; // Toggle the active status
      await user.save();

      res.json({
        msg: `User status updated to ${user.active ? "active" : "inactive"}`,
        user: user.email,
      });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid user ID format." });
      }
      res.status(500).send("Server Error");
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete a user - Admin/Super Admin only
// @access  Private (Admin, Super Admin)
router.delete(
  "/:id",
  protect,
  authorizeRoles(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const user = await Patient.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      // Prevent Admins from deleting Super Admins
      if (req.user.role === "admin" && user.role === "superadmin") {
        return res
          .status(403)
          .json({ msg: "Access denied. Admins cannot delete Super Admins." });
      }

      // In a real app, you might also delete associated doses here
      // await Dose.deleteMany({ userId: req.params.id });

      await user.deleteOne(); // Use deleteOne() for Mongoose 6+

      res.json({ msg: "User removed." });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(400).json({ msg: "Invalid user ID format." });
      }
      res.status(500).send("Server Error");
    }
  }
);

// Note: Contact update functionality is now handled by /update-profile/:id route

// Note: Test route is already defined at the top of the file

// Note: update-profile route is already defined above

// Export the router
module.exports = router;
