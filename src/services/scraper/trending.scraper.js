const axios = require("axios");
const googleTrends = require("google-trends-api");
const RSSParser = require("rss-parser");
const { env } = require("../../config/env");
const { logger } = require("../../utils/logger");

const parser = new RSSParser({ timeout: 10000 });

async function scrapeYouTubeTrending() {
  if (
    !env.YOUTUBE_API_KEY ||
    env.YOUTUBE_API_KEY === "your-youtube-data-api-v3-key"
  ) {
    return [];
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=20&key=${env.YOUTUBE_API_KEY}`;
    const { data } = await axios.get(url, { timeout: 10000 });

    return (data.items ?? []).map((item) => ({
      title: item.snippet.title ?? "",
      body: item.snippet.description?.slice(0, 500) ?? "",
      url: `https://www.youtube.com/watch?v=${item.id}`,
      source: "youtube",
      category: "VIRAL",
      imageUrl: item.snippet.thumbnails?.medium?.url ?? null,
      publishedAt: new Date(item.snippet.publishedAt),
      upvotes: parseInt(item.statistics?.viewCount ?? "0", 10),
    }));
  } catch (err) {
    logger.warn("YouTube trending scrape failed", { error: err.message });
    return [];
  }
}

async function scrapeGoogleTrends() {
  try {
    const rawResult = await googleTrends.dailyTrends({ geo: "US" });
    const parsed = JSON.parse(rawResult);
    const trendingSearches =
      parsed?.default?.trendingSearchesDays?.[0]?.trendingSearches ?? [];

    return trendingSearches.slice(0, 20).map((trend) => ({
      title: trend.title?.query ?? "",
      body: trend.articles?.[0]?.snippet ?? "",
      url:
        trend.articles?.[0]?.url ??
        `https://trends.google.com/trends/trendingsearches/daily?geo=US`,
      source: "google-trends",
      category: "VIRAL",
      imageUrl: trend.image?.imgUrl ?? null,
      publishedAt: new Date(),
      upvotes:
        parseInt(trend.formattedTraffic?.replace(/[^0-9]/g, "") ?? "0", 10) ||
        0,
    }));
  } catch (err) {
    logger.warn("Google Trends scrape failed", { error: err.message });
    return [];
  }
}

async function scrapeUrbanDictionary() {
  try {
    const feed = await parser.parseURL(
      "https://www.urbandictionary.com/wordoftheday.rss",
    );
    return feed.items.slice(0, 5).map((item) => ({
      title: item.title ?? "",
      body: item.contentSnippet ?? item.content ?? "",
      url: item.link ?? "https://www.urbandictionary.com",
      source: "urban-dictionary",
      category: "CULTURE",
      imageUrl: null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      upvotes: 0,
    }));
  } catch (err) {
    logger.warn("Urban Dictionary RSS scrape failed", { error: err.message });
    return [];
  }
}

async function scrapeTrending() {
  const results = await Promise.allSettled([
    scrapeYouTubeTrending(),
    scrapeGoogleTrends(),
    scrapeUrbanDictionary(),
  ]);

  const items = [];
  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
  }
  return items;
}

module.exports = { scrapeTrending };
