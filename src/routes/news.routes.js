const { Router } = require("express");
const { newsController } = require("../controllers/news.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { publicRateLimit } = require("../middleware/rateLimit.middleware");
const { validate } = require("../middleware/validate.middleware");
const {
  interactionSchema,
  categoryParamSchema,
} = require("../models/newsCard.model");

const router = Router();

router.use(authMiddleware, publicRateLimit);

router.get("/feed", newsController.getFeed);
router.get("/feed/fresh", newsController.getFreshFeed);
router.get("/saved", newsController.getSavedCards);
router.post("/save/:id", newsController.saveCard);
router.delete("/saved/:id", newsController.unsaveCard);
router.get(
  "/category/:category",
  validate(categoryParamSchema, "params"),
  newsController.getByCategory,
);
router.post(
  "/interact",
  validate(interactionSchema),
  newsController.logInteraction,
);
router.get("/:id/voice", newsController.getCardVoice);
router.get("/:id", newsController.getCardById);

module.exports = router;
