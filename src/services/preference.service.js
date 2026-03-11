const { prisma } = require("../config/prisma");
const { cacheService } = require("./cache.service");
const { logger } = require("../utils/logger");
const {
  PREFERENCE_DELTAS,
  CACHE_KEYS,
  CACHE_TTL,
} = require("../config/constants");

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function categoryToField(category) {
  const map = {
    TECH: "techScore",
    CULTURE: "cultureScore",
    WORLD: "worldScore",
    VIRAL: "viralScore",
    SCIENCE: "scienceScore",
    FINANCE: "financeScore",
  };
  return map[category] ?? null;
}

async function getOrCreatePreferences(userId) {
  let pref = await prisma.userPreference.findUnique({ where: { userId } });
  if (!pref) {
    pref = await prisma.userPreference.create({
      data: { userId },
    });
  }
  return pref;
}

async function getUserPreferenceScores(userId) {
  const cacheKey = CACHE_KEYS.userPreferences(userId);
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const pref = await getOrCreatePreferences(userId);
  await cacheService.set(cacheKey, pref, CACHE_TTL.USER_PREFERENCES);
  return pref;
}

async function updatePreferenceFromInteraction(
  userId,
  category,
  interactionType,
) {
  const delta = PREFERENCE_DELTAS[interactionType] ?? 0;
  if (!delta) return;

  const field = categoryToField(category);
  if (!field) return;

  const alpha = 0.1;
  const pref = await getOrCreatePreferences(userId);
  const current = pref[field] ?? 0.5;
  const newScore = Math.max(
    0,
    Math.min(1, current + alpha * (delta - current)),
  );

  await prisma.userPreference.update({
    where: { userId },
    data: { [field]: newScore, updatedAt: new Date() },
  });

  await cacheService.del(CACHE_KEYS.userPreferences(userId));
}

async function updateStreak(userId) {
  const pref = await getOrCreatePreferences(userId);
  const now = new Date();
  const today = toDateOnly(now);
  const lastActive = pref.lastActiveDate
    ? toDateOnly(new Date(pref.lastActiveDate))
    : null;

  let newStreak = pref.currentStreak ?? 0;
  let newLongest = pref.longestStreak ?? 0;

  if (!lastActive) {
    newStreak = 1;
  } else {
    const diff = Math.round(
      (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff === 0) return pref;
    if (diff === 1) {
      newStreak = newStreak + 1;
    } else {
      newStreak = 1;
    }
  }

  newLongest = Math.max(newLongest, newStreak);

  const updated = await prisma.userPreference.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: now,
    },
  });

  await cacheService.del(CACHE_KEYS.userPreferences(userId));
  return updated;
}

async function getStreakData(userId) {
  const pref = await getUserPreferenceScores(userId);
  return {
    currentStreak: pref.currentStreak ?? 0,
    longestStreak: pref.longestStreak ?? 0,
    lastActiveDate: pref.lastActiveDate,
  };
}

async function getCategoryAffinity(userId) {
  const pref = await getUserPreferenceScores(userId);
  return {
    TECH: pref.techScore ?? 0.5,
    CULTURE: pref.cultureScore ?? 0.5,
    WORLD: pref.worldScore ?? 0.5,
    VIRAL: pref.viralScore ?? 0.5,
    SCIENCE: pref.scienceScore ?? 0.5,
    FINANCE: pref.financeScore ?? 0.5,
  };
}

async function getUserStats(userId) {
  const [interactionCount, savedCount, streak] = await Promise.all([
    prisma.interaction.count({ where: { userId } }),
    prisma.savedCard.count({ where: { userId } }),
    getStreakData(userId),
  ]);

  return {
    totalInteractions: interactionCount,
    totalSaved: savedCount,
    ...streak,
  };
}

async function updatePreferences(userId, data) {
  const updated = await prisma.userPreference.update({
    where: { userId },
    data: { ...data, updatedAt: new Date() },
  });
  await cacheService.del(CACHE_KEYS.userPreferences(userId));
  return updated;
}

const preferenceService = {
  getUserPreferenceScores,
  updatePreferenceFromInteraction,
  updateStreak,
  getStreakData,
  getCategoryAffinity,
  getUserStats,
  getOrCreatePreferences,
  updatePreferences,
};

module.exports = { preferenceService };
