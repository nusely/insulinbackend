// Load environment variables from .env file
require("dotenv").config();

// Import necessary libraries
const express = require("express");
const cors = require("cors");
// Import the database connection function
const connectDB = require("./db");
// Import the authentication routes
const authRoutes = require("./routes/auth");
// Import the dose routes
const doseRoutes = require("./routes/doses");
// Import the admin routes
const adminRoutes = require("./routes/admin");
// Import the scheduled jobs
const { scheduleSubscriptionJob } = require("./jobs/subscriptionJob"); // Subscription notifications

// MONITORING SETUP - Monitoring endpoints are registered below

// Create an instance of an Express application
const app = express();

// --- Middleware ---
// CORS configuration based on environment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow any origin
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, only allow the frontend URL
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://insulin.batistasimons.com',
      'https://insulin.batistasimons.com',
      'http://localhost:5173' // Keep for local testing
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control']
};

// Apply CORS configuration
app.use(cors(corsOptions));

// Additional CORS headers for more flexibility
app.use((req, res, next) => {
  // Set the origin header based on the request
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://insulin.batistasimons.com',
    'https://insulin.batistasimons.com',
    'http://localhost:5173'
  ];
  
  if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  // Allow specific methods
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );

  // Allow specific headers including cache-control
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control"
  );

  // Allow credentials
  res.header("Access-Control-Allow-Credentials", true);

  console.log(
    `CORS headers set for request from: ${req.headers.origin || "unknown"}`
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Enable parsing of JSON request bodies
app.use(express.json({ limit: "1mb" }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Set global timeout for all requests (60 seconds)
app.use((req, res, next) => {
  req.setTimeout(60000); // 60 seconds
  res.setTimeout(60000); // 60 seconds
  next();
});

// --- Database Connection ---
// Call the connectDB function to establish MongoDB connection
// Wait for database connection before starting the server
const startServer = async () => {
  try {
    await connectDB();

    // --- Schedule Cron Jobs ---
    // Start the comprehensive reminder job (replaces old reminder job)
    const { scheduleComprehensiveReminderJob } = require("./jobs/comprehensiveReminderJob");
    scheduleComprehensiveReminderJob(); // Enable comprehensive SMS reminders
    // Start the subscription management job
    scheduleSubscriptionJob(); // Check subscriptions daily and send notifications

    // Define the port the server will run on.
    const PORT = process.env.PORT || 5000;

    // Monitoring endpoints and helpers are now registered in monitoring-setup.js
    require("./monitoring-setup")(app);

    // --- API Routes ---
    // This is a basic test route for the homepage
    app.get("/", (req, res) => {
      res.send(
        "Hello, World! Your backend server is running and connected to the database."
      );
    });

    // --- API Routes ---
    app.use("/api/auth", authRoutes); // Authentication routes (register, login, etc.)
    app.use("/api/doses", doseRoutes); // Dose management routes
    app.use("/api/admin", adminRoutes); // Admin-specific routes
    app.use("/api/patients", require("./routes/patients")); // Patient management routes
    app.use("/api/users", require("./routes/users")); // User management routes

    // CORS diagnostic endpoint for testing
    app.get("/api/cors-test", (req, res) => {
      // Return CORS headers and diagnostic information
      const corsInfo = {
        success: true,
        message: "CORS headers check successful",
        requestHeaders: req.headers,
        corsHeaders: {
          "access-control-allow-origin": res.getHeader(
            "Access-Control-Allow-Origin"
          ),
          "access-control-allow-methods": res.getHeader(
            "Access-Control-Allow-Methods"
          ),
          "access-control-allow-headers": res.getHeader(
            "Access-Control-Allow-Headers"
          ),
          "access-control-allow-credentials": res.getHeader(
            "Access-Control-Allow-Credentials"
          ),
        },
        timestamp: new Date().toISOString(),
      };

      console.log("CORS test endpoint accessed:", corsInfo);
      res.json(corsInfo);
    });

    // Special route to handle email verification links - redirects to frontend
    app.get("/verify-email/:token", (req, res) => {
      const { token } = req.params;
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      console.log(
        `Email verification redirect: ${token} -> ${frontendUrl}/verify-email/${token}`
      );
      res.redirect(`${frontendUrl}/verify-email/${token}`);
    });

    // ======= SPA FRONTEND FALLBACK (START) =======
    // Serve static frontend files and index.html for unknown routes
    const path = require("path");
    app.use(express.static(path.join(__dirname, "../insulinfrontend/dist")));
    
    // Catch-all handler: send back React's index.html file for SPA routing
    // Using Express.js native catch-all middleware instead of route pattern
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, "../insulinfrontend/dist/index.html"));
    });
    // ======= SPA FRONTEND FALLBACK (END) =======

    // Start the server and make it listen for incoming requests on the specified port.
    // Explicitly listen on IPv4 (127.0.0.1) to avoid IPv6 binding issues
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Server is running successfully on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
