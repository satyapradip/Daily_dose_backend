const RSSParser = require("rss-parser");
const { RSS_SOURCES } = require("../../config/constants");
const { logger } = require("../../utils/logger");

const parser = new RSSParser({
  timeout: 10000,
  headers: { "User-Agent": "DailyDose/1.0 RSS Bot" },
});

function extractImageFromItem(item) {
  return (
    item["media:content"]?.$.url ??
    item["media:thumbnail"]?.$.url ??
    item.enclosure?.url ??
    null
  );
}

async function scrapeRSSSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    return feed.items.map((item) => ({
      title: item.title ?? "",
      body: item.contentSnippet ?? item.content ?? item.summary ?? "",
      url: item.link ?? item.guid ?? "",
      source: source.name,
      category: source.category,
      imageUrl: extractImageFromItem(item),
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      upvotes: 0,
    }));
  } catch (err) {
    logger.warn(`RSS scrape failed for ${source.name}`, { error: err.message });
    return [];
  }
}

async function scrapeAllRSS() {
  const results = await Promise.allSettled(RSS_SOURCES.map(scrapeRSSSource));
  const items = [];
  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
  }
  return items;
}

module.exports = { scrapeAllRSS };
