"use strict";

jest.mock("@prisma/client", () => ({
  VibeType: {
    SARCASTIC: "SARCASTIC",
    DRAMATIC: "DRAMATIC",
    CONSPIRACY: "CONSPIRACY",
    AUNTY: "AUNTY",
  },
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

const {
  VIBE_PROMPTS,
  getVibeLabel,
} = require("../../src/services/ai/vibe.service");

describe("VIBE_PROMPTS", () => {
  it("should have entries for all four vibe types", () => {
    expect(VIBE_PROMPTS).toHaveProperty("SARCASTIC");
    expect(VIBE_PROMPTS).toHaveProperty("DRAMATIC");
    expect(VIBE_PROMPTS).toHaveProperty("CONSPIRACY");
    expect(VIBE_PROMPTS).toHaveProperty("AUNTY");
  });

  it("each prompt should be a non-empty string", () => {
    Object.values(VIBE_PROMPTS).forEach((prompt) => {
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(10);
    });
  });

  it("SARCASTIC prompt should convey sarcastic tone", () => {
    const lower = VIBE_PROMPTS.SARCASTIC.toLowerCase();
    expect(
      lower.includes("sarcas") ||
        lower.includes("wit") ||
        lower.includes("irony") ||
        lower.includes("ironic"),
    ).toBe(true);
  });

  it("CONSPIRACY prompt should mention theories or hidden", () => {
    const lower = VIBE_PROMPTS.CONSPIRACY.toLowerCase();
    expect(
      lower.includes("conspir") ||
        lower.includes("hidden") ||
        lower.includes("secret") ||
        lower.includes("theory") ||
        lower.includes("truth"),
    ).toBe(true);
  });

  it("DRAMATIC prompt should convey drama or emotion", () => {
    const lower = VIBE_PROMPTS.DRAMATIC.toLowerCase();
    expect(
      lower.includes("drama") ||
        lower.includes("intense") ||
        lower.includes("emotion"),
    ).toBe(true);
  });

  it("AUNTY prompt should reference Indian aunty style", () => {
    const lower = VIBE_PROMPTS.AUNTY.toLowerCase();
    expect(
      lower.includes("aunty") ||
        lower.includes("auntie") ||
        lower.includes("indian") ||
        lower.includes("desi"),
    ).toBe(true);
  });
});

describe("getVibeLabel", () => {
  it("should return a human-readable label for each vibe", () => {
    expect(typeof getVibeLabel("SARCASTIC")).toBe("string");
    expect(typeof getVibeLabel("DRAMATIC")).toBe("string");
    expect(typeof getVibeLabel("CONSPIRACY")).toBe("string");
    expect(typeof getVibeLabel("AUNTY")).toBe("string");
  });
});
