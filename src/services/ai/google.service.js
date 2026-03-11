const { GoogleGenerativeAI } = require("@google/generative-ai");
const { env } = require("../../config/env");
const { AI_CONFIG, CACHE_KEYS, CACHE_TTL } = require("../../config/constants");
const { cacheService } = require("../cache.service");
const { logger } = require("../../utils/logger");
const { VIBE_PROMPTS } = require("./vibe.service");
const { ENRICHMENT_PROMPT } = require("./summarizer.service");

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

class ClaudeService {
  getModel(systemPrompt) {
    return genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: env.GEMINI_MAX_TOKENS },
    });
  }

  async callClaude(systemPrompt, userMessage) {
    let lastError = null;

    for (let attempt = 1; attempt <= AI_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const model = this.getModel(systemPrompt);
        const result = await model.generateContent(userMessage);
        const text = result.response.text().trim();
        const usage = result.response.usageMetadata;
        const tokensUsed =
          (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

        return {
          text,
          tokensUsed,
          cached: false,
          generatedAt: new Date(),
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const msg = lastError.message;
        if (
          msg.includes("API_KEY_INVALID") ||
          msg.includes("PERMISSION_DENIED") ||
          msg.includes("401") ||
          msg.includes("403")
        ) {
          throw lastError;
        }

        if (attempt < AI_CONFIG.MAX_RETRIES) {
          const delay =
            AI_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn(
            `Gemini API attempt ${attempt} failed, retrying in ${delay}ms`,
            {
              error: lastError.message,
            },
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  async generateVibeContent(card, vibe) {
    const cacheKey = CACHE_KEYS.vibeContent(card.id, vibe);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return {
        text: cached,
        tokensUsed: 0,
        cached: true,
        generatedAt: new Date(),
      };
    }

    const userMessage = `Headline: ${card.headline}\nSummary: ${card.summary}`;

    let response;
    try {
      response = await this.callClaude(VIBE_PROMPTS[vibe], userMessage);
    } catch (err) {
      logger.error("Gemini vibe generation failed, using fallback", {
        cardId: card.id,
        vibe,
        error: err instanceof Error ? err.message : String(err),
      });
      response = {
        text: card.summary,
        tokensUsed: 0,
        cached: false,
        generatedAt: new Date(),
      };
    }

    await cacheService.set(cacheKey, response.text, CACHE_TTL.VIBE_CONTENT);
    return response;
  }

  async summarizeArticle(fullText, cardId) {
    const cacheKey = CACHE_KEYS.articleSummary(cardId);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const systemPrompt =
      "You are a concise news editor. Summarize the given article in exactly 2 sentences. Be conversational, slightly witty, and accessible to a Gen-Z audience.";

    try {
      const response = await this.callClaude(
        systemPrompt,
        fullText.slice(0, 4000),
      );
      await cacheService.set(
        cacheKey,
        response.text,
        CACHE_TTL.ARTICLE_SUMMARY,
      );
      return response.text;
    } catch (err) {
      logger.error("Article summarization failed", {
        cardId,
        error: err instanceof Error ? err.message : String(err),
      });
      return fullText.slice(0, 200) + "...";
    }
  }

  async categorizeArticle(headline, body) {
    const systemPrompt =
      "You are a news categorizer. Given a headline and article body, respond with ONLY one of these category words (no other text): TECH, CULTURE, WORLD, VIRAL, SCIENCE, FINANCE";
    const userMessage = `Headline: ${headline}\n\nBody excerpt: ${body.slice(0, 500)}`;

    try {
      const response = await this.callClaude(systemPrompt, userMessage);
      const category = response.text.trim().toUpperCase();
      const validCategories = [
        "TECH",
        "CULTURE",
        "WORLD",
        "VIRAL",
        "SCIENCE",
        "FINANCE",
      ];
      return validCategories.includes(category) ? category : "WORLD";
    } catch {
      return "WORLD";
    }
  }

  async explainTrend(text) {
    const systemPrompt =
      "You are a cultural commentator who explains internet trends and memes to a wide audience. Keep explanations under 100 words, conversational, and engaging. No jargon.";

    try {
      const response = await this.callClaude(systemPrompt, text);
      return response.text;
    } catch (err) {
      logger.error("Trend explanation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async bulkEnrich(items) {
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const enriched = await Promise.allSettled(
        batch.map((item) => this.enrichSingleItem(item)),
      );

      enriched.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          logger.warn(`Failed to enrich item: ${batch[idx]?.url}`, {
            error: result.reason,
          });
          const fallbackItem = batch[idx];
          if (fallbackItem) {
            results.push({
              headline: fallbackItem.title.slice(0, 80),
              summary: fallbackItem.body.slice(0, 200),
              category: fallbackItem.category ?? "WORLD",
              trendRelevance: 0.5,
              unsplashQuery: "news world events",
              tags: [],
            });
          }
        }
      });

      if (i + batchSize < items.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return results;
  }

  async enrichSingleItem(item) {
    const userMessage = `Title: ${item.title}\n\nContent: ${item.body.slice(0, 1000)}\n\nSource: ${item.source}`;
    const response = await this.callClaude(ENRICHMENT_PROMPT, userMessage);

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Gemini did not return valid JSON");

    return JSON.parse(jsonMatch[0]);
  }
}

const claudeService = new ClaudeService();

module.exports = { claudeService };
