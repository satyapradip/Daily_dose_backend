const { logger } = require("./logger");

async function fetchUnsplashImage(query) {
  try {
    if (!query || query.trim().length === 0) return null;

    const sanitized = query
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const encoded = encodeURIComponent(sanitized);
    const prompt = `${encoded}%2C%20news%20photography%2C%20photorealistic`;

    return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=450&nologo=true&model=flux`;
  } catch (err) {
    logger.warn(`Pollinations image URL build failed for query "${query}":`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

module.exports = { fetchUnsplashImage };
