const { prisma } = require("../config/prisma");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/error.middleware");
const { preferenceService } = require("../services/preference.service");
const { VibeType } = require("@prisma/client");

const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      selectedVibe: true,
      createdAt: true,
    },
  });
  if (!user) throw new ApiError("User not found", 404);
  res.json({ success: true, data: user });
});

const updateVibe = asyncHandler(async (req, res) => {
  const { vibe } = req.body;

  if (!Object.values(VibeType).includes(vibe)) {
    throw new ApiError(
      `Invalid vibe. Must be one of: ${Object.values(VibeType).join(", ")}`,
      400,
    );
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { selectedVibe: vibe },
    select: { id: true, email: true, username: true, selectedVibe: true },
  });

  res.json({ success: true, data: user });
});

const getPreferences = asyncHandler(async (req, res) => {
  const prefs = await preferenceService.getUserPreferenceScores(req.user.id);
  res.json({ success: true, data: prefs });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const prefs = await preferenceService.updatePreferences(
    req.user.id,
    req.body,
  );
  res.json({ success: true, data: prefs });
});

const getStreak = asyncHandler(async (req, res) => {
  const streak = await preferenceService.getStreakData(req.user.id);
  res.json({ success: true, data: streak });
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await preferenceService.getUserStats(req.user.id);
  res.json({ success: true, data: stats });
});

const userController = {
  getMe,
  updateVibe,
  getPreferences,
  updatePreferences,
  getStreak,
  getStats,
};

module.exports = { userController };
