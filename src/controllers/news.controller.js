const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/error.middleware");
const { newsService } = require("../services/news.service");
const { preferenceService } = require("../services/preference.service");
const { claudeService } = require("../services/ai/google.service");
const { voiceService } = require("../services/ai/voice.service");
const { logger } = require("../utils/logger");

const getFeed = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page ?? "1", 10);
  const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
  const result = await newsService.getPersonalizedFeed(
    req.user.id,
    page,
    limit,
  );
  await preferenceService.updateStreak(req.user.id);
  res.json({ success: true, data: result });
});

const getFreshFeed = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
  const cards = await newsService.getFreshFeed(limit);
  res.json({ success: true, data: cards });
});

const getCardById = asyncHandler(async (req, res) => {
  const card = await newsService.getCardById(req.params.id);
  if (!card) throw new ApiError("News card not found", 404);
  res.json({ success: true, data: card });
});

const getByCategory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page ?? "1", 10);
  const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
  const result = await newsService.getCardsByCategory(
    req.params.category,
    page,
    limit,
  );
  res.json({ success: true, data: result });
});

const logInteraction = asyncHandler(async (req, res) => {
  const { newsCardId, type, metadata } = req.body;

  const card = await newsService.getCardById(newsCardId);
  if (!card) throw new ApiError("News card not found", 404);

  const interaction = await newsService.logInteraction(
    req.user.id,
    newsCardId,
    type,
    metadata,
  );

  await preferenceService
    .updatePreferenceFromInteraction(req.user.id, card.category, type)
    .catch((err) =>
      logger.warn("Preference update failed", { error: err.message }),
    );

  res.status(201).json({ success: true, data: interaction });
});

const saveCard = asyncHandler(async (req, res) => {
  const saved = await newsService.saveCard(req.user.id, req.params.id);
  res.status(201).json({ success: true, data: saved });
});

const unsaveCard = asyncHandler(async (req, res) => {
  await newsService.unsaveCard(req.user.id, req.params.id);
  res.json({ success: true, message: "Card unsaved" });
});

const getSavedCards = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page ?? "1", 10);
  const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
  const result = await newsService.getSavedCards(req.user.id, page, limit);
  res.json({ success: true, data: result });
});

const getPendingCards = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page ?? "1", 10);
  const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
  const result = await newsService.getPendingCards(page, limit);
  res.json({ success: true, data: result });
});

const approveCard = asyncHandler(async (req, res) => {
  const card = await newsService.approveCard(req.params.id);
  res.json({ success: true, data: card });
});

const getCardVoice = asyncHandler(async (req, res) => {
  const card = await newsService.getCardById(req.params.id);
  if (!card) throw new ApiError("News card not found", 404);

  const text = `${card.headline}. ${card.summary}`;
  const audioBuffer = await voiceService.textToSpeech(text);

  res.set({
    "Content-Type": "audio/wav",
    "Content-Length": audioBuffer.length,
  });
  res.send(audioBuffer);
});

const newsController = {
  getFeed,
  getFreshFeed,
  getCardById,
  getByCategory,
  logInteraction,
  saveCard,
  unsaveCard,
  getSavedCards,
  getPendingCards,
  approveCard,
  getCardVoice,
};

module.exports = { newsController };
