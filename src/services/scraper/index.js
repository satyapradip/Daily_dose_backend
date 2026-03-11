const { prisma } = require("../../config/prisma");
const { logger } = require("../../utils/logger");
const { claudeService } = require("../ai/google.service");
const { fetchUnsplashImage } = require("../../utils/imageProxy");
const { scrapeAllRSS } = require("./rss.scraper");
const { scrapeAllReddit } = require("./reddit.scraper");
const { scrapeTrending } = require("./trending.scraper");
const {
  deduplicateItems,
  scoreTrendRelevance,
  normalizeAll,
} = require("./cleaner");
const { VibeType } = require("@prisma/client");

let isRunning = false;

async function runScrapePipeline() {
  if (isRunning) {
    logger.info("[Scraper] Pipeline already running, skipping");
    return;
  }
  isRunning = true;

  const run = await prisma.scraperRun.create({
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    logger.info("[Scraper] Starting scrape pipeline");

    const [rssResults, redditResults, trendingResults] =
      await Promise.allSettled([
        scrapeAllRSS(),
        scrapeAllReddit(),
        scrapeTrending(),
      ]);

    const rawItems = normalizeAll([rssResults, redditResults, trendingResults]);
    logger.info(`[Scraper] Scraped ${rawItems.length} raw items`);

    const unique = deduplicateItems(rawItems);
    logger.info(`[Scraper] ${unique.length} items after deduplication`);

    if (unique.length === 0) {
      await prisma.scraperRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          itemsScraped: 0,
          itemsSaved: 0,
        },
      });
      return;
    }

    const scored = scoreTrendRelevance(unique);
    const enriched = await claudeService.bulkEnrich(scored);
    const saved = await pregenerateVibeContent(enriched);

    await prisma.scraperRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        itemsScraped: rawItems.length,
        itemsSaved: saved,
      },
    });

    logger.info(`[Scraper] Pipeline complete. Saved ${saved} cards.`);
  } catch (err) {
    logger.error("[Scraper] Pipeline failed", { error: err.message });
    await prisma.scraperRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: err.message,
      },
    });
  } finally {
    isRunning = false;
  }
}

async function pregenerateVibeContent(enrichedItems) {
  let savedCount = 0;

  for (const item of enrichedItems) {
    try {
      const existing = await prisma.newsCard.findFirst({
        where: { sourceUrl: item.url },
      });
      if (existing) continue;

      const imageUrl = await fetchUnsplashImage(
        item.unsplashQuery ?? item.headline,
      );

      const card = await prisma.newsCard.create({
        data: {
          headline: item.headline,
          summary: item.summary,
          category: item.category,
          sourceUrl: item.url ?? "",
          imageUrl,
          trendScore: item.trendRelevance ?? 0.5,
          tags: item.tags ?? [],
          isApproved: true,
          publishedAt: item.publishedAt ?? new Date(),
        },
      });

      await Promise.allSettled(
        Object.values(VibeType).map(async (vibe) => {
          const result = await claudeService.generateVibeContent(card, vibe);
          return prisma.vibeContent.create({
            data: { newsCardId: card.id, vibe, content: result.text },
          });
        }),
      );

      savedCount++;
    } catch (err) {
      logger.warn(`[Scraper] Failed to save card: ${item.url}`, {
        error: err.message,
      });
    }
  }

  return savedCount;
}

async function backfillVibeContent() {
  const cards = await prisma.newsCard.findMany({
    where: { isApproved: true },
    include: { vibeContents: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const vibes = Object.values(VibeType);
  let backfilled = 0;

  for (const card of cards) {
    const existingVibes = new Set(card.vibeContents.map((vc) => vc.vibe));
    const missing = vibes.filter((v) => !existingVibes.has(v));

    for (const vibe of missing) {
      try {
        const result = await claudeService.generateVibeContent(card, vibe);
        await prisma.vibeContent.create({
          data: { newsCardId: card.id, vibe, content: result.text },
        });
        backfilled++;
      } catch (err) {
        logger.warn(
          `[Scraper] Backfill failed for card ${card.id} vibe ${vibe}`,
          {
            error: err.message,
          },
        );
      }
    }
  }

  logger.info(`[Scraper] Backfilled ${backfilled} vibe content entries`);
}

const scraperService = {
  runScrapePipeline,
  pregenerateVibeContent,
  backfillVibeContent,
};

module.exports = { scraperService };
