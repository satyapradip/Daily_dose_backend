const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

function createLimiter(maxRequests, windowMs) {
  return rateLimit({
    windowMs: windowMs ?? env.RATE_LIMIT_WINDOW_MS,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    // In-memory store — works without Redis, sufficient for single-instance deploy
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please slow down.",
          statusCode: 429,
        },
      });
    },
    skip: () => env.NODE_ENV === "test",
  });
}

const publicRateLimit = createLimiter(60);
const authRateLimit = createLimiter(10);
const aiRateLimit = createLimiter(20);
const adminRateLimit = createLimiter(100);

module.exports = {
  publicRateLimit,
  authRateLimit,
  aiRateLimit,
  adminRateLimit,
};
