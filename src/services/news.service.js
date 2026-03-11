const { prisma } = require("../config/prisma");
const { cacheService } = require("./cache.service");
const { logger } = require("../utils/logger");
const { CACHE_KEYS, CACHE_TTL, FEED_DEFAULTS } = require("../config/constants");

function getRandomSubset(arr, n) {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function getPersonalizedFeed(
  userId,
  page = 1,
  limit = FEED_DEFAULTS.PAGE_SIZE,
) {
  const skip = (page - 1) * limit;

  const [cards, total] = await Promise.all([
    prisma.newsCard.findMany({
      where: { isApproved: true },
      orderBy: [{ trendScore: "desc" }, { publishedAt: "desc" }],
      skip,
      take: limit,
      include: { vibeContents: true },
    }),
    prisma.newsCard.count({ where: { isApproved: true } }),
  ]);

  return {
    cards,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: skip + cards.length < total,
    },
  };
}

async function getFreshFeed(limit = FEED_DEFAULTS.FRESH_LIMIT) {
  const cacheKey = CACHE_KEYS.freshFeed();
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const cards = await prisma.newsCard.findMany({
    where: { isApproved: true },
    orderBy: { publishedAt: "desc" },
    take: limit * 3,
    include: { vibeContents: true },
  });

  const result = getRandomSubset(cards, limit);
  await cacheService.set(cacheKey, result, CACHE_TTL.FRESH_FEED);
  return result;
}

async function getCardById(id) {
  const cacheKey = CACHE_KEYS.newsCard(id);
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const card = await prisma.newsCard.findUnique({
    where: { id },
    include: { vibeContents: true },
  });

  if (card) await cacheService.set(cacheKey, card, CACHE_TTL.NEWS_CARD);
  return card;
}

async function getCardsByCategory(
  category,
  page = 1,
  limit = FEED_DEFAULTS.PAGE_SIZE,
) {
  const skip = (page - 1) * limit;

  const [cards, total] = await Promise.all([
    prisma.newsCard.findMany({
      where: { isApproved: true, category },
      orderBy: [{ trendScore: "desc" }, { publishedAt: "desc" }],
      skip,
      take: limit,
      include: { vibeContents: true },
    }),
    prisma.newsCard.count({ where: { isApproved: true, category } }),
  ]);

  return {
    cards,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: skip + cards.length < total,
    },
  };
}

async function logInteraction(userId, newsCardId, type, metadata = {}) {
  const interaction = await prisma.interaction.create({
    data: { userId, newsCardId, type, metadata },
  });
  return interaction;
}

async function saveCard(userId, newsCardId) {
  const existing = await prisma.savedCard.findFirst({
    where: { userId, newsCardId },
  });
  if (existing) return existing;
  return prisma.savedCard.create({ data: { userId, newsCardId } });
}

async function unsaveCard(userId, newsCardId) {
  return prisma.savedCard.deleteMany({ where: { userId, newsCardId } });
}

async function getSavedCards(
  userId,
  page = 1,
  limit = FEED_DEFAULTS.PAGE_SIZE,
) {
  const skip = (page - 1) * limit;

  const [savedCards, total] = await Promise.all([
    prisma.savedCard.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      skip,
      take: limit,
      include: { newsCard: { include: { vibeContents: true } } },
    }),
    prisma.savedCard.count({ where: { userId } }),
  ]);

  return {
    cards: savedCards.map((sc) => sc.newsCard),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: skip + savedCards.length < total,
    },
  };
}

async function getPendingCards(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [cards, total] = await Promise.all([
    prisma.newsCard.findMany({
      where: { isApproved: false },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.newsCard.count({ where: { isApproved: false } }),
  ]);

  return {
    cards,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: skip + cards.length < total,
    },
  };
}

async function approveCard(id) {
  return prisma.newsCard.update({ where: { id }, data: { isApproved: true } });
}

const newsService = {
  getPersonalizedFeed,
  getFreshFeed,
  getCardById,
  getCardsByCategory,
  logInteraction,
  saveCard,
  unsaveCard,
  getSavedCards,
  getPendingCards,
  approveCard,
};

module.exports = { newsService };
