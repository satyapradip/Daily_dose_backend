"use strict";

// Mock env first before any other requires
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

const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUserPreferenceCreate = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    userPreference: { create: mockUserPreferenceCreate, findUnique: jest.fn() },
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

jest.mock("../../src/services/preference.service", () => ({
  preferenceService: {
    getOrCreatePreferences: jest.fn().mockResolvedValue({}),
    updateStreak: jest.fn().mockResolvedValue({}),
    getUserPreferenceScores: jest.fn().mockResolvedValue({}),
  },
}));

const express = require("express");
const supertest = require("supertest");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const { errorMiddleware } = require("../../src/middleware/error.middleware");
const authRoutes = require("../../src/routes/auth.routes");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/auth", authRoutes);
app.use(errorMiddleware);

const request = supertest(app);

const hashedPw = bcrypt.hashSync("Password123!", 12);

describe("POST /api/v1/auth/register", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should register a new user successfully", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "uuid-1",
      email: "test@example.com",
      username: "testuser",
      selectedVibe: null,
    });

    const res = await request.post("/api/v1/auth/register").send({
      email: "test@example.com",
      username: "testuser",
      password: "Password123!",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe("test@example.com");
  });

  it("should return 409 if email/username already in use", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing" });

    const res = await request.post("/api/v1/auth/register").send({
      email: "taken@example.com",
      username: "takenuser",
      password: "Password123!",
    });

    expect(res.status).toBe(409);
  });

  it("should return 400 on validation error (short password)", async () => {
    const res = await request.post("/api/v1/auth/register").send({
      email: "bad@example.com",
      username: "user",
      password: "short",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should login successfully with correct credentials", async () => {
    mockFindUnique.mockResolvedValue({
      id: "uuid-1",
      email: "test@example.com",
      username: "testuser",
      password: hashedPw,
      selectedVibe: null,
    });
    mockUpdate.mockResolvedValue({});

    const res = await request.post("/api/v1/auth/login").send({
      email: "test@example.com",
      password: "Password123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("should return 401 when user not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await request.post("/api/v1/auth/login").send({
      email: "ghost@example.com",
      password: "Password123!",
    });

    expect(res.status).toBe(401);
  });

  it("should return 401 on wrong password", async () => {
    mockFindUnique.mockResolvedValue({
      id: "uuid-1",
      email: "test@example.com",
      password: hashedPw,
    });

    const res = await request.post("/api/v1/auth/login").send({
      email: "test@example.com",
      password: "WrongPassword!",
    });

    expect(res.status).toBe(401);
  });

  it("should return 400 when email is missing", async () => {
    const res = await request.post("/api/v1/auth/login").send({
      password: "Password123!",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("should clear refreshToken cookie and return success", async () => {
    const res = await request.post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("should return 400 when refresh token is missing", async () => {
    const res = await request.post("/api/v1/auth/refresh").send({});
    expect(res.status).toBe(400);
  });
});
