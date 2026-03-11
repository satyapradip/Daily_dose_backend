const cron = require("node-cron");
const { logger } = require("../utils/logger");

let scraperService;
let claudeService;
let prismaInstance;

function init(deps) {
  scraperService = deps.scraperService;
  claudeService = deps.claudeService;
  prismaInstance = deps.prisma;
}

function startAll() {
  // Every 6 hours — run scrape pipeline
  cron.schedule("0 */6 * * *", async () => {
    logger.info("[Scheduler] Running scheduled scrape pipeline");
    try {
      await scraperService.runScrapePipeline();
    } catch (err) {
      logger.error("[Scheduler] Scrape pipeline failed", {
        error: err.message,
      });
    }
  });

  // 6am IST (00:30 UTC) — daily brief reset
  cron.schedule("30 0 * * *", async () => {
    logger.info("[Scheduler] Running daily brief reset");
    try {
      await prismaInstance.newsCard.updateMany({
        where: { isApproved: true },
        data: { trendScore: 0.5 },
      });
    } catch (err) {
      logger.error("[Scheduler] Daily brief reset failed", {
        error: err.message,
      });
    }
  });

  // Midnight UTC — streak reset check
  cron.schedule("0 0 * * *", async () => {
    logger.info("[Scheduler] Running midnight streak maintenance");
  });

  // Every hour — cache cleanup (handled by Redis TTL, just log)
  cron.schedule("0 * * * *", () => {
    logger.debug("[Scheduler] Hourly cache heartbeat");
  });

  // Every 30 minutes — vibe content backfill
  cron.schedule("*/30 * * * *", async () => {
    logger.info("[Scheduler] Running vibe content backfill");
    try {
      await scraperService.backfillVibeContent();
    } catch (err) {
      logger.error("[Scheduler] Vibe backfill failed", { error: err.message });
    }
  });

  logger.info("[Scheduler] All cron jobs started");
}

const schedulerService = { init, startAll };

module.exports = { schedulerService };
