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

const mockNewsCardFindUnique = jest.fn();
const mockVibeContentFindUnique = jest.fn();
const mockVibeContentUpsert = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    newsCard: { findUnique: mockNewsCardFindUnique },
    vibeContent: {
      findUnique: mockVibeContentFindUnique,
      upsert: mockVibeContentUpsert,
    },
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

jest.mock("../../src/services/cache.service", () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGenerateVibeContent = jest.fn();
const mockSummarizeArticle = jest.fn();
const mockExplainTrend = jest.fn();

jest.mock("../../src/services/ai/google.service", () => ({
  claudeService: {
    generateVibeContent: mockGenerateVibeContent,
    summarizeArticle: mockSummarizeArticle,
    explainTrend: mockExplainTrend,
  },
}));

const express = require("express");
const supertest = require("supertest");
const jwt = require("jsonwebtoken");
const { errorMiddleware } = require("../../src/middleware/error.middleware");
const aiRoutes = require("../../src/routes/ai.routes");

const app = express();
app.use(express.json());
app.use("/api/v1/ai", aiRoutes);
app.use(errorMiddleware);

const request = supertest(app);

const testToken = jwt.sign(
  { userId: "user-1", email: "test@example.com" },
  "test-secret-key-for-jest-at-least-32-chars",
  { expiresIn: "1h" },
);

const cardId = "550e8400-e29b-41d4-a716-446655440000";

const mockCard = {
  id: cardId,
  headline: "AI Takes Over Everything",
  summary: "Robots now doing everything",
  category: "TECH",
};

describe("GET /api/v1/ai/vibe/:cardId/:vibe", () => {
  it("should return existing vibe content from DB", async () => {
    mockNewsCardFindUnique.mockResolvedValue(mockCard);
    mockVibeContentFindUnique.mockResolvedValue({
      id: "vc-1",
      newsCardId: cardId,
      vibe: "SARCASTIC",
      content: "Oh wow, AI, how original...",
    });

    const res = await request
      .get(`/api/v1/ai/vibe/${cardId}/SARCASTIC`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cached).toBe(true);
    expect(res.body.data.content).toBeDefined();
    expect(mockGenerateVibeContent).not.toHaveBeenCalled();
  });

  it("should generate vibe content when not cached", async () => {
    mockNewsCardFindUnique.mockResolvedValue(mockCard);
    mockVibeContentFindUnique.mockResolvedValue(null);
    mockGenerateVibeContent.mockResolvedValue({
      text: "Generated content",
      cached: false,
      tokensUsed: 100,
    });
    mockVibeContentUpsert.mockResolvedValue({
      id: "vc-2",
      newsCardId: cardId,
      vibe: "DRAMATIC",
      content: "Generated content",
    });

    const res = await request
      .get(`/api/v1/ai/vibe/${cardId}/DRAMATIC`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(mockGenerateVibeContent).toHaveBeenCalled();
  });

  it("should return 404 when card not found", async () => {
    mockNewsCardFindUnique.mockResolvedValue(null);

    const res = await request
      .get(`/api/v1/ai/vibe/${cardId}/SARCASTIC`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });

  it("should return 400 for invalid vibe", async () => {
    const res = await request
      .get(`/api/v1/ai/vibe/${cardId}/INVALID_VIBE`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(400);
  });

  it("should return 401 when no token", async () => {
    const res = await request.get(`/api/v1/ai/vibe/${cardId}/SARCASTIC`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/ai/vibe/regenerate", () => {
  it("should regenerate vibe content", async () => {
    mockNewsCardFindUnique.mockResolvedValue(mockCard);
    mockGenerateVibeContent.mockResolvedValue({
      text: "Regenerated!",
      cached: false,
    });
    mockVibeContentUpsert.mockResolvedValue({
      id: "vc-3",
      content: "Regenerated!",
    });

    const res = await request
      .post("/api/v1/ai/vibe/regenerate")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ cardId, vibe: "CONSPIRACY" });

    expect(res.status).toBe(200);
    expect(mockGenerateVibeContent).toHaveBeenCalled();
  });

  it("should return 400 if body is invalid", async () => {
    const res = await request
      .post("/api/v1/ai/vibe/regenerate")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ cardId: "not-a-uuid", vibe: "CONSPIRACY" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/ai/summary/:cardId", () => {
  it("should return article summary", async () => {
    mockNewsCardFindUnique.mockResolvedValue(mockCard);
    mockSummarizeArticle.mockResolvedValue("Short summary here.");

    const res = await request
      .get(`/api/v1/ai/summary/${cardId}`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
  });

  it("should return 404 when card not found", async () => {
    mockNewsCardFindUnique.mockResolvedValue(null);

    const res = await request
      .get(`/api/v1/ai/summary/${cardId}`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/ai/explain", () => {
  it("should explain a trend", async () => {
    mockExplainTrend.mockResolvedValue("This trend is about...");

    const res = await request
      .post("/api/v1/ai/explain")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ text: "What is rizz?" });

    expect(res.status).toBe(200);
    expect(res.body.data.explanation).toBeDefined();
  });

  it("should return 400 when text is missing", async () => {
    const res = await request
      .post("/api/v1/ai/explain")
      .set("Authorization", `Bearer ${testToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
