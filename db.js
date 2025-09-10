// backend/db.js

const mongoose = require("mongoose");

/**
 * @function connectDB
 * @description Establishes a connection to the MongoDB database using Mongoose.
 * It uses the MONGO_URI from environment variables.
 * Logs success or error messages to the console.
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      console.error(
        "Error: MONGO_URI is not defined in environment variables."
      );
      process.exit(1); // Exit process with failure
    }

    await mongoose.connect(mongoURI, {
      // Minimal settings for faster connection
      maxPoolSize: 5,
      bufferCommands: false,
    });

    console.log("MongoDB connected successfully.");

    // Add connection event listeners
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected successfully.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    // Exit process with failure if database connection fails
    process.exit(1);
  }
};

module.exports = connectDB;
