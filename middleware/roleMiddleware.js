// backend/middleware/roleMiddleware.js

/**
 * @function authorizeRoles
 * @description Middleware to authorize access based on user roles.
 * @param {string[]} allowedRoles - An array of roles that are permitted to access the route.
 * @returns {function} An Express middleware function.
 */
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    console.log(
      "Role middleware hit for:",
      req.method,
      req.url,
      "Required roles:",
      allowedRoles
    );
    console.log("User role:", req.user?.role);

    // Check if req.user (populated by protect middleware) exists and has a role
    if (!req.user || !req.user.role) {
      console.log("Role middleware: User role not found");
      return res
        .status(403)
        .json({ msg: "Access denied. User role not found." });
    }

    // Check if the user's role is included in the allowedRoles array
    if (!allowedRoles.includes(req.user.role)) {
      console.log("Role middleware: Access denied, insufficient role");
      return res.status(403).json({
        msg: `Access denied. Requires one of the following roles: ${allowedRoles.join(
          ", "
        )}.`,
      });
    }

    console.log("Role middleware: Authorization successful");
    next(); // User is authorized, proceed to the next middleware or route handler
  };
};

module.exports = { authorizeRoles };
