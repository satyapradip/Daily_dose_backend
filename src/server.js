const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { prisma } = require("./config/prisma");
const { env } = require("./config/env");
const { logger } = require("./utils/logger");
const { errorMiddleware } = require("./middleware/error.middleware");
const routes = require("./routes/index");

const app = express();

// Security & parsers
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected", env: env.NODE_ENV });
  } catch (err) {
    res
      .status(503)
      .json({ status: "error", db: "disconnected", error: err.message });
  }
});

// API routes
app.use(env.API_PREFIX, routes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use(errorMiddleware);

// Start only when run directly
if (require.main === module) {
  const port = env.PORT;

  // Lazy-load scheduler to avoid circular deps at import time
  const { schedulerService } = require("./services/scheduler.service");
  const { scraperService } = require("./services/scraper/index");
  const { claudeService } = require("./services/ai/claude.service");

  schedulerService.init({ scraperService, claudeService, prisma });

  app.listen(port, () => {
    logger.info(`Server running on port ${port} [${env.NODE_ENV}]`);
    schedulerService.startAll();
  });

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    await prisma.$disconnect();
    process.exit(0);
  });
}

module.exports = app;
module.exports.prisma = prisma;
