const { Router } = require("express");
const { z } = require("zod");
const { aiController } = require("../controllers/ai.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { aiRateLimit } = require("../middleware/rateLimit.middleware");
const { validate } = require("../middleware/validate.middleware");

const vibeParamSchema = z.object({
  cardId: z.string().uuid(),
  vibe: z.enum(["SARCASTIC", "DRAMATIC", "CONSPIRACY", "AUNTY"]),
});

const regenerateSchema = z.object({
  cardId: z.string().uuid(),
  vibe: z.enum(["SARCASTIC", "DRAMATIC", "CONSPIRACY", "AUNTY"]),
});

const explainSchema = z.object({
  text: z.string().min(1).max(2000),
});

const router = Router();

router.use(authMiddleware, aiRateLimit);

router.get(
  "/vibe/:cardId/:vibe",
  validate(vibeParamSchema, "params"),
  aiController.getVibeContent,
);
router.post(
  "/vibe/regenerate",
  validate(regenerateSchema),
  aiController.regenerateVibeContent,
);
router.get("/summary/:cardId", aiController.getSummary);
router.post("/explain", validate(explainSchema), aiController.explainTrend);

module.exports = router;
