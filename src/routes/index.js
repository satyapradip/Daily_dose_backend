const { Router } = require("express");
const authRoutes = require("./auth.routes");
const newsRoutes = require("./news.routes");
const userRoutes = require("./user.routes");
const aiRoutes = require("./ai.routes");
const scraperRoutes = require("./scraper.routes");

const router = Router();

router.use("/auth", authRoutes);
router.use("/news", newsRoutes);
router.use("/user", userRoutes);
router.use("/ai", aiRoutes);
router.use("/admin", scraperRoutes);

module.exports = router;
