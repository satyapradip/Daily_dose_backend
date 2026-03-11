const { logger } = require("../utils/logger");

function errorMiddleware(err, req, res, _next) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? "INTERNAL_SERVER_ERROR";

  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    statusCode,
    code,
    stack: err.stack,
  });

  const message =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again."
      : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      statusCode,
    },
  });
}

class ApiError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "ApiError";
  }

  static notFound(resource = "Resource") {
    return new ApiError(`${resource} not found.`, 404, "NOT_FOUND");
  }

  static unauthorized(message = "Authentication required.") {
    return new ApiError(message, 401, "UNAUTHORIZED");
  }

  static forbidden(message = "Access denied.") {
    return new ApiError(message, 403, "FORBIDDEN");
  }

  static badRequest(message) {
    return new ApiError(message, 400, "BAD_REQUEST");
  }

  static conflict(message) {
    return new ApiError(message, 409, "CONFLICT");
  }
}

module.exports = { errorMiddleware, ApiError };
