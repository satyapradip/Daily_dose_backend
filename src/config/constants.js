const { Category } = require("@prisma/client");

// ─────────────────────────────────────────────
// Source Weights (for trend scoring)
// ─────────────────────────────────────────────
const SOURCE_WEIGHTS = {
  "BBC News": 1.0,
  "The Hindu": 0.9,
  TechCrunch: 0.85,
  "The Verge": 0.85,
  Vice: 0.75,
  Reddit: 0.7,
  YouTube: 0.65,
  "Google Trends": 0.6,
  "Urban Dictionary": 0.5,
};

// ─────────────────────────────────────────────
// RSS Feed Sources
// ─────────────────────────────────────────────
const RSS_SOURCES = [
  {
    name: "BBC News",
    url: "http://feeds.bbci.co.uk/news/rss.xml",
    category: Category.WORLD,
  },
  {
    name: "The Hindu",
    url: "https://www.thehindu.com/feeder/default.rss",
    category: Category.WORLD,
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    category: Category.TECH,
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    category: Category.TECH,
  },
  {
    name: "Vice",
    url: "https://www.vice.com/en/rss",
    category: Category.CULTURE,
  },
];

// ─────────────────────────────────────────────
// Reddit Sources
// ─────────────────────────────────────────────
const REDDIT_SOURCES = [
  { subreddit: "memes", category: Category.VIRAL, minUpvotes: 10000 },
  { subreddit: "worldnews", category: Category.WORLD, minUpvotes: 5000 },
  { subreddit: "technology", category: Category.TECH, minUpvotes: 3000 },
  { subreddit: "GenZ", category: Category.CULTURE, minUpvotes: 2000 },
  {
    subreddit: "interestingasfuck",
    category: Category.VIRAL,
    minUpvotes: 8000,
  },
];

// ─────────────────────────────────────────────
// Cache TTLs (seconds)
// ─────────────────────────────────────────────
const CACHE_TTL = {
  VIBE_CONTENT: 86400, // 24 hours
  NEWS_FEED: 1800, // 30 minutes
  TRENDING_CARDS: 3600, // 1 hour
  USER_PREFERENCES: 300, // 5 minutes
  ARTICLE_SUMMARY: 86400, // 24 hours
  SCRAPER_LOCK: 3600, // 1 hour
};

// ─────────────────────────────────────────────
// Cache Key Patterns
// ─────────────────────────────────────────────
const CACHE_KEYS = {
  vibeContent: (cardId, vibe) => `vibe:${cardId}:${vibe}`,
  newsFeed: (userId, page) => `feed:${userId}:${page}`,
  trending: (category) => `trending:${category}`,
  userPrefs: (userId) => `prefs:${userId}`,
  articleSummary: (cardId) => `summary:${cardId}`,
  scraperLock: () => "scraper:lock",
};

// ─────────────────────────────────────────────
// Preference Score Delta (per interaction type)
// ─────────────────────────────────────────────
const PREFERENCE_DELTAS = {
  SWIPE_RIGHT: 0.05,
  SAVED: 0.05,
  VOICE_PLAYED: 0.03,
  EXPANDED: 0.03,
  REACTED: 0.02,
  SHARED: 0.04,
  SWIPE_LEFT: -0.03,
};

// ─────────────────────────────────────────────
// Trend Scoring Weights
// ─────────────────────────────────────────────
const TREND_SCORE_WEIGHTS = {
  AGE: 0.4,
  ENGAGEMENT: 0.35,
  SOURCE: 0.25,
};

const TREND_AGE_DECAY_HOURS = 12;
const TREND_MAX_UPVOTES = 50000;

// ─────────────────────────────────────────────
// Feed Configuration
// ─────────────────────────────────────────────
const FEED_DEFAULTS = {
  PAGE_SIZE: 10,
  DISCOVERY_RATIO: 0.2,
  CARD_SCORE_WEIGHTS: {
    CATEGORY: 0.5,
    TREND: 0.3,
    RECENCY: 0.2,
  },
};

// ─────────────────────────────────────────────
// Scraper
// ─────────────────────────────────────────────
const SCRAPER_CONFIG = {
  MIN_TREND_SCORE: 0.4,
  MAX_CARDS_FOR_AI_ENRICHMENT: 20,
  REDDIT_USER_AGENT: "ContextCrash/1.0",
};

// ─────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────
const AI_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
};

module.exports = {
  SOURCE_WEIGHTS,
  RSS_SOURCES,
  REDDIT_SOURCES,
  CACHE_TTL,
  CACHE_KEYS,
  PREFERENCE_DELTAS,
  TREND_SCORE_WEIGHTS,
  TREND_AGE_DECAY_HOURS,
  TREND_MAX_UPVOTES,
  FEED_DEFAULTS,
  SCRAPER_CONFIG,
  AI_CONFIG,
};
