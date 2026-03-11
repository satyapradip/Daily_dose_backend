const { Router } = require("express");
const { authController } = require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const { authRateLimit } = require("../middleware/rateLimit.middleware");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require("../models/user.model");

const router = Router();

router.post(
  "/register",
  authRateLimit,
  validate(registerSchema),
  authController.register,
);
router.post(
  "/login",
  authRateLimit,
  validate(loginSchema),
  authController.login,
);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", authController.logout);

module.exports = router;
