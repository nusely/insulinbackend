const nodemailer = require("nodemailer");

/**
 * Send email using nodemailer with Gmail SMTP
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @returns {Promise} - Nodemailer result
 */
async function sendEmailFixed({ to, subject, html }) {
  try {
    console.log("Attempting to send email...");
    console.log("Email config check:");
    console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✓ Set" : "✗ Missing");
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✓ Set" : "✗ Missing");

    // Configure transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      timeout: 10000,
      connectionTimeout: 10000,
    });

    // Verify configuration
    console.log("Verifying email configuration...");
    await transporter.verify();
    console.log("Email configuration verified successfully");

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    };

    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);

    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("Email sending failed:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Full error:", error);

    throw new Error(`Email sending failed: ${error.message}`);
  }
}

module.exports = sendEmailFixed;
