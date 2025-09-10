# InsulinLog Backend Documentation

## Setup Instructions

1. **Clone the repository:**

   ```sh
   git clone <your-repo-url>
   cd insulinbackend
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Configure environment variables:**

   - Copy `.env.example` or `.env.production.template` to `.env` and fill in the required values (MongoDB URI, JWT secret, etc).

4. **Start the server:**

   ```sh
   npm start
   ```

   The server will run on the port specified in `.env` (default: 5000).

5. **Access monitoring dashboard:**
   - Visit `http://localhost:5000/dashboard` for live monitoring.

---

## API Reference

### Monitoring Endpoints

- **GET `/health`**

  - Returns: `{ status: "healthy", timestamp: <ISO string> }`
  - Purpose: Health check for uptime monitoring.

- **GET `/metrics`**

  - Returns: `{ uptime: <seconds>, timestamp: <ISO string> }`
  - Purpose: Returns server uptime and timestamp.

- **GET `/dashboard`**
  - Returns: HTML dashboard with live uptime chart and pretty JSON.
  - Purpose: Visual monitoring for admins.

---

### Example Main API Endpoints

- **POST `/api/auth/register`**

  - Registers a new user.
  - Body: `{ email, password, ... }`
  - Returns: User object or error.

- **POST `/api/auth/login`**

  - Logs in a user.
  - Body: `{ email, password }`
  - Returns: JWT token or error.

- **GET `/api/patients`**

  - Returns: List of patients (auth required).

- **POST `/api/doses`**

  - Adds a new insulin dose (auth required).

- **GET `/api/admin/users`**
  - Admin: List all users.

> **Note:** For full API details, see the route files in `/routes/` and controller logic in `/controllers/`.

---

## Additional Notes

- **Security:** CORS, request logging, and security middleware are enabled.
- **Jobs:** Automated reminders and subscription checks run on schedule.
- **Testing:** Remove test and mock files before production deployment.
- **Monitoring:** `/dashboard` is for internal/admin use only.

---

For further details, see the codebase or contact the maintainers.
