// backend/middleware/authMiddleware.js

const jwt = require("jsonwebtoken");
// No User model import needed - using Patient model now

/**
 * @function protect
 * @description Middleware to protect routes, ensuring only authenticated users can access.
 * Verifies the JWT from the Authorization header.
 * Attaches the decoded user payload (id, role) to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  console.log("Auth middleware hit for:", req.method, req.url);

  // Check if Authorization header exists and starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user information (excluding password) to the request object
      // We are only attaching id and role from the token payload,
      // as the token itself is the source of truth for authentication.
      // Fetching the user from DB here is optional and depends on whether
      // you need full user object on every protected request.
      // For simplicity and performance, we'll just use the decoded payload for now.
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      console.error("Token verification failed:", error.message);
      return res.status(401).json({ msg: "Not authorized, token failed." });
    }
  }

  if (!token) {
    return res.status(401).json({ msg: "Not authorized, no token." });
  }
};

module.exports = { protect };
