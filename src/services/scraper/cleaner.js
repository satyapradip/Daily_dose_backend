const crypto = require("crypto");
const {
  SOURCE_WEIGHTS,
  TREND_AGE_DECAY_HOURS,
  TREND_MAX_UPVOTES,
  TREND_SCORE_WEIGHTS,
} = require("../../config/constants");

function hashUrl(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function deduplicateItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const hash = hashUrl(item.url);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

function calculateTrendScore(item) {
  const now = Date.now();
  const publishedAt =
    item.publishedAt instanceof Date
      ? item.publishedAt
      : new Date(item.publishedAt ?? now);
  const ageHours = (now - publishedAt.getTime()) / (1000 * 60 * 60);
  const decayFactor = Math.exp(-ageHours / TREND_AGE_DECAY_HOURS);

  const upvotes = item.upvotes ?? 0;
  const engagementScore = Math.min(upvotes / TREND_MAX_UPVOTES, 1);

  const sourceWeight = SOURCE_WEIGHTS[item.source] ?? 0.5;

  const score =
    TREND_SCORE_WEIGHTS.RECENCY * decayFactor +
    TREND_SCORE_WEIGHTS.ENGAGEMENT * engagementScore +
    TREND_SCORE_WEIGHTS.SOURCE * sourceWeight;

  return Math.min(Math.max(score, 0), 1);
}

function scoreTrendRelevance(items) {
  return items.map((item) => ({
    ...item,
    trendScore: calculateTrendScore(item),
  }));
}

function normalizeAll(settled) {
  const items = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      items.push(...result.value);
    }
  }
  return items;
}

module.exports = {
  hashUrl,
  deduplicateItems,
  calculateTrendScore,
  scoreTrendRelevance,
  normalizeAll,
};
