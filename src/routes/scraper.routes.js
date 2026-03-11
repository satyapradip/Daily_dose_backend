const { Router } = require("express");
const { newsController } = require("../controllers/news.controller");
const { adminMiddleware } = require("../middleware/auth.middleware");
const { adminRateLimit } = require("../middleware/rateLimit.middleware");
const { scraperService } = require("../services/scraper/index");
const { prisma } = require("../config/prisma");
const { asyncHandler } = require("../utils/asyncHandler");

const router = Router();

router.use(adminMiddleware, adminRateLimit);

router.post(
  "/scrape/trigger",
  asyncHandler(async (_req, res) => {
    setImmediate(() => scraperService.runScrapePipeline().catch(() => {}));
    res.json({ success: true, message: "Scrape pipeline triggered" });
  }),
);

router.get(
  "/scrape/status",
  asyncHandler(async (_req, res) => {
    const latest = await prisma.scraperRun.findFirst({
      orderBy: { startedAt: "desc" },
    });
    res.json({ success: true, data: latest });
  }),
);

router.get("/cards/pending", newsController.getPendingCards);
router.post("/cards/approve/:id", newsController.approveCard);

module.exports = router;
