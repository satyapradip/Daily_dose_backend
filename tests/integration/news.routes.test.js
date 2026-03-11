"use strict";

jest.mock("../../src/config/env", () => ({
  env: {
    JWT_SECRET: "test-secret-key-for-jest-at-least-32-chars",
    JWT_EXPIRES_IN: "1h",
    JWT_REFRESH_EXPIRES_IN: "7d",
    NODE_ENV: "test",
    PORT: 3000,
    API_PREFIX: "/api/v1",
    CORS_ORIGIN: "http://localhost:3000",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-2.0-flash",
    GEMINI_MAX_TOKENS: 1000,
    GEMINI_TTS_MODEL: "gemini-2.5-flash-preview-tts",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    ADMIN_SECRET_KEY: "test-admin-key",
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 60,
    YOUTUBE_API_KEY: "test-yt-key",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  },
}));

jest.mock("../../src/middleware/rateLimit.middleware", () => {
  const pass = (_req, _res, next) => next();
  return {
    publicRateLimit: pass,
    authRateLimit: pass,
    aiRateLimit: pass,
    adminRateLimit: pass,
  };
});

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    newsCard: {},
    interaction: {},
    savedCard: {},
    $queryRaw: jest.fn().mockResolvedValue([]),
  })),
  VibeType: {
    SARCASTIC: "SARCASTIC",
    DRAMATIC: "DRAMATIC",
    CONSPIRACY: "CONSPIRACY",
    AUNTY: "AUNTY",
  },
  InteractionType: {
    SWIPE_LEFT: "SWIPE_LEFT",
    SWIPE_RIGHT: "SWIPE_RIGHT",
    SAVED: "SAVED",
    VOICE_PLAYED: "VOICE_PLAYED",
    EXPANDED: "EXPANDED",
    REACTED: "REACTED",
    SHARED: "SHARED",
  },
  Category: {
    TECH: "TECH",
    CULTURE: "CULTURE",
    WORLD: "WORLD",
    VIRAL: "VIRAL",
    SCIENCE: "SCIENCE",
    FINANCE: "FINANCE",
  },
}));

const mockGetFeed = jest.fn();
const mockGetFreshFeed = jest.fn();
const mockGetCardById = jest.fn();
const mockGetCardsByCategory = jest.fn();
const mockLogInteraction = jest.fn();
const mockSaveCard = jest.fn();
const mockUnsaveCard = jest.fn();
const mockGetSavedCards = jest.fn();

jest.mock("../../src/services/news.service", () => ({
  newsService: {
    getPersonalizedFeed: mockGetFeed,
    getFreshFeed: mockGetFreshFeed,
    getCardById: mockGetCardById,
    getCardsByCategory: mockGetCardsByCategory,
    logInteraction: mockLogInteraction,
    saveCard: mockSaveCard,
    unsaveCard: mockUnsaveCard,
    getSavedCards: mockGetSavedCards,
    getPendingCards: jest.fn(),
    approveCard: jest.fn(),
  },
}));

jest.mock("../../src/services/preference.service", () => ({
  preferenceService: {
    updateStreak: jest.fn().mockResolvedValue({}),
    updatePreferenceFromInteraction: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("../../src/services/cache.service", () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../src/services/ai/voice.service", () => ({
  voiceService: {
    textToSpeech: jest.fn().mockResolvedValue(Buffer.from("audio")),
  },
}));

const express = require("express");
const supertest = require("supertest");
const jwt = require("jsonwebtoken");
const { errorMiddleware } = require("../../src/middleware/error.middleware");
const newsRoutes = require("../../src/routes/news.routes");

const app = express();
app.use(express.json());
app.use("/api/v1/news", newsRoutes);
app.use(errorMiddleware);

const request = supertest(app);

const testToken = jwt.sign(
  { userId: "user-1", email: "test@example.com" },
  "test-secret-key-for-jest-at-least-32-chars",
  { expiresIn: "1h" },
);

const mockCard = {
  id: "00000000-0000-4000-8000-000000000001",
  headline: "Test Headline",
  summary: "Test summary",
  category: "TECH",
  trendScore: 0.8,
  isApproved: true,
  vibeContents: [],
};

describe("GET /api/v1/news/feed", () => {
  it("should return paginated feed for authenticated user", async () => {
    mockGetFeed.mockResolvedValue({
      cards: [mockCard],
      pagination: { page: 1, limit: 20, total: 1, pages: 1, hasMore: false },
    });

    const res = await request
      .get("/api/v1/news/feed")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cards).toHaveLength(1);
  });

  it("should return 401 when no token provided", async () => {
    const res = await request.get("/api/v1/news/feed");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/news/feed/fresh", () => {
  it("should return fresh cards", async () => {
    mockGetFreshFeed.mockResolvedValue([mockCard]);

    const res = await request
      .get("/api/v1/news/feed/fresh")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe("GET /api/v1/news/:id", () => {
  it("should return a single card", async () => {
    mockGetCardById.mockResolvedValue(mockCard);

    const res = await request
      .get(`/api/v1/news/${mockCard.id}`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mockCard.id);
  });

  it("should return 404 when card not found", async () => {
    mockGetCardById.mockResolvedValue(null);

    const res = await request
      .get("/api/v1/news/non-existent-id")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/news/interact", () => {
  it("should log interaction and return 201", async () => {
    mockGetCardById.mockResolvedValue(mockCard);
    mockLogInteraction.mockResolvedValue({ id: "int-1", type: "SWIPE_RIGHT" });

    const res = await request
      .post("/api/v1/news/interact")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ newsCardId: mockCard.id, type: "SWIPE_RIGHT" });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("SWIPE_RIGHT");
  });

  it("should return 400 on invalid interaction type", async () => {
    const res = await request
      .post("/api/v1/news/interact")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ newsCardId: mockCard.id, type: "INVALID_TYPE" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/news/save/:id", () => {
  it("should save a card", async () => {
    mockSaveCard.mockResolvedValue({ id: "saved-1", newsCardId: mockCard.id });

    const res = await request
      .post(`/api/v1/news/save/${mockCard.id}`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/v1/news/saved/:id", () => {
  it("should unsave a card", async () => {
    mockUnsaveCard.mockResolvedValue({ count: 1 });

    const res = await request
      .delete(`/api/v1/news/saved/${mockCard.id}`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("GET /api/v1/news/saved", () => {
  it("should get saved cards", async () => {
    mockGetSavedCards.mockResolvedValue({
      cards: [mockCard],
      pagination: { page: 1, limit: 20, total: 1, pages: 1, hasMore: false },
    });

    const res = await request
      .get("/api/v1/news/saved")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cards).toHaveLength(1);
  });
});
