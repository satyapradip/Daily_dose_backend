const axios = require("axios");
const { REDDIT_SOURCES } = require("../../config/constants");
const { logger } = require("../../utils/logger");

async function scrapeSubreddit(sub) {
  try {
    const url = `https://www.reddit.com/r/${sub.name}/hot.json?limit=25`;
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "DailyDose/1.0 (news aggregator)",
        Accept: "application/json",
      },
    });

    const posts = data?.data?.children ?? [];
    return posts
      .filter((p) => !p.data.stickied && p.data.score > 50)
      .map((p) => ({
        title: p.data.title ?? "",
        body: p.data.selftext ?? p.data.url ?? "",
        url: `https://www.reddit.com${p.data.permalink}`,
        source: `reddit:${sub.name}`,
        category: sub.category,
        imageUrl: p.data.thumbnail?.startsWith("http")
          ? p.data.thumbnail
          : null,
        publishedAt: new Date(p.data.created_utc * 1000),
        upvotes: p.data.score ?? 0,
      }));
  } catch (err) {
    logger.warn(`Reddit scrape failed for r/${sub.name}`, {
      error: err.message,
    });
    return [];
  }
}

async function scrapeAllReddit() {
  const results = await Promise.allSettled(REDDIT_SOURCES.map(scrapeSubreddit));
  const items = [];
  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
  }
  return items;
}

module.exports = { scrapeAllReddit };
