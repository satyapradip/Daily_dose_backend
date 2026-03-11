const { Router } = require("express");
const { userController } = require("../controllers/user.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { publicRateLimit } = require("../middleware/rateLimit.middleware");

const router = Router();

router.use(authMiddleware, publicRateLimit);

router.get("/me", userController.getMe);
router.put("/vibe", userController.updateVibe);
router.get("/preferences", userController.getPreferences);
router.put("/preferences", userController.updatePreferences);
router.get("/streak", userController.getStreak);
router.get("/stats", userController.getStats);

module.exports = router;
