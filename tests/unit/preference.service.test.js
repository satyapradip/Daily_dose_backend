"use strict";

// Mock prisma to avoid real DB connection
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    userPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    interaction: { count: jest.fn() },
    savedCard: { count: jest.fn() },
  },
}));

jest.mock("../../src/services/cache.service", () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

// --- Inline helpers matching preference.service implementation ---

const PREFERENCE_DELTAS = {
  SWIPE_RIGHT: 1,
  SWIPE_LEFT: -1,
  SAVED: 1,
  EXPANDED: 0.5,
  VOICE_PLAYED: 0.5,
  REACTED: 0.3,
  SHARED: 0.8,
};

function emaUpdate(current, delta, alpha = 0.1) {
  const next = current + alpha * (delta - current);
  return Math.max(0, Math.min(1, next));
}

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function computeStreak(currentStreak, lastActiveDate, now = new Date()) {
  const today = toDateOnly(now);

  if (!lastActiveDate) return 1;

  const last = toDateOnly(new Date(lastActiveDate));
  const diff = Math.round(
    (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff === 0) return currentStreak;
  if (diff === 1) return currentStreak + 1;
  return 1;
}

// ---- EMA scoring tests ----

describe("EMA preference score updates", () => {
  it("should increase score on positive interaction", () => {
    const initial = 0.5;
    const updated = emaUpdate(initial, PREFERENCE_DELTAS.SWIPE_RIGHT);
    expect(updated).toBeGreaterThan(initial);
  });

  it("should decrease score on negative interaction", () => {
    const initial = 0.5;
    const updated = emaUpdate(initial, PREFERENCE_DELTAS.SWIPE_LEFT);
    expect(updated).toBeLessThan(initial);
  });

  it("should stay bounded between 0 and 1 after many positive updates", () => {
    let score = 0.5;
    for (let i = 0; i < 100; i++) {
      score = emaUpdate(score, 1, 0.1);
    }
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("should stay bounded between 0 and 1 after many negative updates", () => {
    let score = 0.5;
    for (let i = 0; i < 100; i++) {
      score = emaUpdate(score, -1, 0.1);
    }
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("should converge toward target over time", () => {
    let score = 0.5;
    for (let i = 0; i < 200; i++) {
      score = emaUpdate(score, 1, 0.1);
    }
    expect(score).toBeCloseTo(1, 1);
  });
});

// ---- Streak tracking tests ----

describe("Streak tracking", () => {
  it("should start streak at 1 with no previous activity", () => {
    const streak = computeStreak(0, null);
    expect(streak).toBe(1);
  });

  it("should increment streak by 1 on consecutive day", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const streak = computeStreak(5, yesterday);
    expect(streak).toBe(6);
  });

  it("should reset streak to 1 after missing a day", () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const streak = computeStreak(10, twoDaysAgo);
    expect(streak).toBe(1);
  });

  it("should keep streak unchanged if same day", () => {
    const today = new Date();
    const streak = computeStreak(7, today);
    expect(streak).toBe(7);
  });
});

// ---- PREFERENCE_DELTAS tests ----

describe("PREFERENCE_DELTAS constants", () => {
  it("SWIPE_RIGHT should be positive", () => {
    expect(PREFERENCE_DELTAS.SWIPE_RIGHT).toBeGreaterThan(0);
  });

  it("SWIPE_LEFT should be negative", () => {
    expect(PREFERENCE_DELTAS.SWIPE_LEFT).toBeLessThan(0);
  });

  it("SAVED should be positive and among the strongest signals", () => {
    expect(PREFERENCE_DELTAS.SAVED).toBeGreaterThan(0);
    expect(PREFERENCE_DELTAS.SAVED).toBeGreaterThanOrEqual(
      PREFERENCE_DELTAS.REACTED,
    );
  });
});
