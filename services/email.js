const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MMR_FROM_EMAIL = process.env.MMR_FROM_EMAIL || process.env.SMTP_USER;

function checkEmailConfig() {
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error('Email configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.');
    }
}

let transporter;

try {
    checkEmailConfig();
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: parseInt(SMTP_PORT, 10) === 465, // true for 465, false for other ports
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
} catch (e) {
    console.warn("Email service initialization skipped: " + e.message);
}

/**
 * Send an email with attachments.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email plain text body
 * @param {Array} options.attachments - Array of attachment objects (e.g., { filename, content })
 * @returns {Promise<Object>}
 */
async function sendMmrEmail({ to, subject, body, attachments }) {
    checkEmailConfig(); // Re-check before sending to fail loudly if not configured

    const mailOptions = {
        from: MMR_FROM_EMAIL,
        to,
        subject,
        text: body,
        attachments,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error(`Failed to send email to ${to}: ${error.message}`);
    }
}

module.exports = {
    sendMmrEmail
};
