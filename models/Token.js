// backend/models/Token.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * @swagger
 * components:
 * schemas:
 * Token:
 * type: object
 * required:
 * - userId
 * - token
 * - type
 * - expiresAt
 * properties:
 * userId:
 * type: string
 * description: The ID of the user associated with this token.
 * format: ObjectId
 * token:
 * type: string
 * description: The unique token string (e.g., for email verification or password reset).
 * type:
 * type: string
 * enum: [emailVerification, passwordReset]
 * description: The purpose of the token (e.g., 'emailVerification', 'passwordReset').
 * expiresAt:
 * type: string
 * format: date-time
 * description: The timestamp when the token expires.
 * createdAt:
 * type: string
 * format: date-time
 * description: The timestamp when the token was created.
 * readOnly: true
 */

const TokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Patient", // References the Patient model
  },
  token: {
    type: String,
    required: true,
    unique: true, // Ensures each token is unique
  },
  type: {
    type: String,
    enum: ["emailVerification", "passwordReset"],
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // Automatically delete the token after its expiration time
    // This creates a TTL index in MongoDB
    index: { expires: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Token", TokenSchema);
