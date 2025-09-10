const isProduction = process.env.NODE_ENV === "production";

const logger = {
  info: (message, ...args) => {
    if (!isProduction || process.env.LOG_LEVEL === "verbose") {
      console.log(`ℹ️ ${message}`, ...args);
    }
  },

  error: (message, ...args) => {
    // Always log errors, even in production
    console.error(`❌ ${message}`, ...args);
  },

  warn: (message, ...args) => {
    console.warn(`⚠️ ${message}`, ...args);
  },

  debug: (message, ...args) => {
    if (!isProduction) {
      console.log(`🐛 ${message}`, ...args);
    }
  },

  success: (message, ...args) => {
    if (!isProduction || process.env.LOG_LEVEL === "verbose") {
      console.log(`✅ ${message}`, ...args);
    }
  },
};

module.exports = logger;
