const { prisma } = require("../config/prisma");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/error.middleware");
const { claudeService } = require("../services/ai/google.service");
const { cacheService } = require("../services/cache.service");
const { CACHE_KEYS, CACHE_TTL } = require("../config/constants");
const { logger } = require("../utils/logger");

const getVibeContent = asyncHandler(async (req, res) => {
  const { cardId, vibe } = req.params;

  const card = await prisma.newsCard.findUnique({ where: { id: cardId } });
  if (!card) throw new ApiError("News card not found", 404);

  const existing = await prisma.vibeContent.findUnique({
    where: { newsCardId_vibe: { newsCardId: cardId, vibe } },
  });

  if (existing) {
    return res.json({ success: true, data: existing, cached: true });
  }

  const result = await claudeService.generateVibeContent(card, vibe);

  const saved = await prisma.vibeContent.upsert({
    where: { newsCardId_vibe: { newsCardId: cardId, vibe } },
    create: { newsCardId: cardId, vibe, content: result.text },
    update: { content: result.text },
  });

  res.json({ success: true, data: saved, cached: false });
});

const regenerateVibeContent = asyncHandler(async (req, res) => {
  const { cardId, vibe } = req.body;

  const card = await prisma.newsCard.findUnique({ where: { id: cardId } });
  if (!card) throw new ApiError("News card not found", 404);

  await cacheService.del(CACHE_KEYS.vibeContent(cardId, vibe));

  const result = await claudeService.generateVibeContent(card, vibe);

  const saved = await prisma.vibeContent.upsert({
    where: { newsCardId_vibe: { newsCardId: cardId, vibe } },
    create: { newsCardId: cardId, vibe, content: result.text },
    update: { content: result.text },
  });

  res.json({ success: true, data: saved });
});

const getSummary = asyncHandler(async (req, res) => {
  const { cardId } = req.params;

  const cacheKey = CACHE_KEYS.articleSummary(cardId);
  const cached = await cacheService.get(cacheKey);
  if (cached)
    return res.json({ success: true, data: { summary: cached }, cached: true });

  const card = await prisma.newsCard.findUnique({ where: { id: cardId } });
  if (!card) throw new ApiError("News card not found", 404);

  const summary = await claudeService.summarizeArticle(card.summary, cardId);
  res.json({ success: true, data: { summary }, cached: false });
});

const explainTrend = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw new ApiError("Text is required", 400);

  const explanation = await claudeService.explainTrend(text);
  res.json({ success: true, data: { explanation } });
});

const aiController = {
  getVibeContent,
  regenerateVibeContent,
  getSummary,
  explainTrend,
};

module.exports = { aiController };
