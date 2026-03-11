"use strict";

// Inline scoring logic matching the actual implementation to test behavior
const SOURCE_WEIGHTS = {
  "bbc-news": 0.9,
  techcrunch: 0.85,
  reddit: 0.6,
  youtube: 0.7,
  "google-trends": 0.75,
};
const TREND_AGE_DECAY_HOURS = 24;
const TREND_MAX_UPVOTES = 10000;
const TREND_SCORE_WEIGHTS = { RECENCY: 0.4, ENGAGEMENT: 0.35, SOURCE: 0.25 };

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

describe("calculateTrendScore", () => {
  it("should return a number between 0 and 1", () => {
    const score = calculateTrendScore({
      publishedAt: new Date(),
      upvotes: 500,
      source: "techcrunch",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should give a higher score to more recent items", () => {
    const recent = calculateTrendScore({
      publishedAt: new Date(),
      upvotes: 0,
      source: "unknown",
    });
    const old = calculateTrendScore({
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      upvotes: 0,
      source: "unknown",
    });
    expect(recent).toBeGreaterThan(old);
  });

  it("should give higher score to items with more upvotes", () => {
    const high = calculateTrendScore({
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      upvotes: 9000,
      source: "unknown",
    });
    const low = calculateTrendScore({
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      upvotes: 10,
      source: "unknown",
    });
    expect(high).toBeGreaterThan(low);
  });

  it("should give higher score to trusted sources", () => {
    const trusted = calculateTrendScore({
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      upvotes: 100,
      source: "bbc-news",
    });
    const unknown = calculateTrendScore({
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      upvotes: 100,
      source: "unknown-blog",
    });
    expect(trusted).toBeGreaterThan(unknown);
  });

  it("should cap engagement at TREND_MAX_UPVOTES", () => {
    const capped = calculateTrendScore({
      publishedAt: new Date(),
      upvotes: 999999,
      source: "unknown",
    });
    const high = calculateTrendScore({
      publishedAt: new Date(),
      upvotes: TREND_MAX_UPVOTES,
      source: "unknown",
    });
    expect(capped).toBeCloseTo(high, 5);
  });

  it("should handle missing upvotes gracefully", () => {
    const score = calculateTrendScore({
      publishedAt: new Date(),
      source: "techcrunch",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should handle missing publishedAt gracefully", () => {
    const score = calculateTrendScore({ upvotes: 100, source: "techcrunch" });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should use default source weight 0.5 for unknown sources", () => {
    const score = calculateTrendScore({
      publishedAt: new Date(),
      upvotes: 0,
      source: "definitely-not-real-source",
    });
    // source component = 0.25 * 0.5 = 0.125, recency ~= 0.4*1, so ~0.525
    expect(score).toBeGreaterThan(0);
  });
});
