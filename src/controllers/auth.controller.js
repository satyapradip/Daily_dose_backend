const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../config/prisma");
const { env } = require("../config/env");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../middleware/error.middleware");
const { preferenceService } = require("../services/preference.service");

function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

const register = asyncHandler(async (req, res) => {
  const { email, username, password, selectedVibe } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    throw new ApiError("Email or username already in use", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      selectedVibe: selectedVibe ?? null,
    },
  });

  await preferenceService.getOrCreatePreferences(user.id);

  const accessToken = signToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken(user.id);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        selectedVibe: user.selectedVibe,
      },
      accessToken,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError("Invalid credentials", 401);

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new ApiError("Invalid credentials", 401);

  const accessToken = signToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        selectedVibe: user.selectedVibe,
      },
      accessToken,
    },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
  if (!token) throw new ApiError("Refresh token not provided", 401);

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError("Invalid or expired refresh token", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new ApiError("User not found", 401);

  const accessToken = signToken({ userId: user.id, email: user.email });

  res.json({ success: true, data: { accessToken } });
});

const logout = asyncHandler(async (_req, res) => {
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out" });
});

const authController = { register, login, refresh, logout };

module.exports = { authController };
