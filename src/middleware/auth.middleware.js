const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function authMiddleware(req, res, next) {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Provide a Bearer token.",
        statusCode: 401,
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      success: false,
      error: {
        code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
        message: isExpired
          ? "Your session has expired. Please log in again."
          : "Invalid authentication token.",
        statusCode: 401,
      },
    });
  }
}

function adminMiddleware(req, res, next) {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== env.ADMIN_SECRET_KEY) {
    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      },
    });
    return;
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };
