const rateLimit = require("express-rate-limit");

module.exports = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // safer for QR + retries
  standardHeaders: true,
  legacyHeaders: false
});
