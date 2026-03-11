# ContextCrash Backend

AI-powered daily news brief backend. Scrapes RSS/Reddit/YouTube, enriches with Gemini, serves personalized vibe-filtered feeds.

---

## Tech Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Runtime       | Node.js 20+                             |
| Language      | JavaScript (CommonJS, no TypeScript)    |
| Framework     | Express 4.19                            |
| Database      | PostgreSQL via Prisma ORM (Supabase)    |
| Cache         | Redis (ioredis)                         |
| AI            | Google Gemini (`gemini-2.0-flash`)      |
| TTS           | Gemini TTS (`gemini-2.5-flash-preview`) |
| Auth          | JWT + bcryptjs                          |
| Validation    | Zod                                     |
| Logging       | Winston                                 |
| Scheduling    | node-cron                               |
| Rate Limiting | express-rate-limit + rate-limit-redis   |
| Testing       | Jest + Supertest (57 tests, 6 suites)   |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or a Supabase project)
- Redis 7+

---

## Setup

### 1. Clone & Install

```bash
cd contextcrash-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in all values (see [Environment Variables](#environment-variables) below).

### 3. Database

```bash
# Push schema to DB (no migration history)
npm run db:push

# Or use migrations
npm run db:migrate

# (Optional) Open Prisma Studio
npm run db:studio
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Run in Production

```bash
npm start
```

---

## Environment Variables

All variables are validated at startup via Zod. The app will crash with a clear error if any required variable is missing or malformed.

| Variable                 | Required | Description                                      | Default                        |
| ------------------------ | -------- | ------------------------------------------------ | ------------------------------ |
| `PORT`                   | No       | HTTP port                                        | `3000`                         |
| `NODE_ENV`               | No       | `development` / `production` / `test`            | —                              |
| `DATABASE_URL`           | **Yes**  | PostgreSQL connection string                     | —                              |
| `REDIS_URL`              | **Yes**  | Redis connection string                          | —                              |
| `JWT_SECRET`             | **Yes**  | Min 32-char secret for JWT signing               | —                              |
| `JWT_EXPIRES_IN`         | No       | Access token TTL                                 | `15m`                          |
| `JWT_REFRESH_EXPIRES_IN` | No       | Refresh token TTL                                | `7d`                           |
| `GEMINI_API_KEY`         | **Yes**  | Google Gemini API key                            | —                              |
| `GEMINI_MODEL`           | No       | Gemini model for text generation                 | `gemini-2.0-flash`             |
| `GEMINI_TTS_MODEL`       | No       | Gemini model for TTS                             | `gemini-2.5-flash-preview-tts` |
| `GEMINI_MAX_TOKENS`      | No       | Max output tokens per request                    | `1000`                         |
| `YOUTUBE_API_KEY`        | **Yes**  | YouTube Data API v3 key                          | —                              |
| `ADMIN_SECRET_KEY`       | **Yes**  | Secret for `X-Admin-Key` header                  | —                              |
| `CORS_ORIGIN`            | No       | Allowed CORS origin                              | `http://localhost:3000`        |
| `API_PREFIX`             | No       | Route prefix                                     | `/api/v1`                      |
| `SUPABASE_URL`           | No       | Supabase project URL (if using Supabase storage) | —                              |
| `SUPABASE_ANON_KEY`      | No       | Supabase anon key                                | —                              |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Health Check

```
GET /health
```

Returns DB status. `200` if healthy, `503` otherwise.

---

### Auth

| Method | Endpoint         | Auth   | Description          |
| ------ | ---------------- | ------ | -------------------- |
| `POST` | `/auth/register` | None   | Register new user    |
| `POST` | `/auth/login`    | None   | Login, receive JWT   |
| `POST` | `/auth/refresh`  | Cookie | Refresh access token |
| `POST` | `/auth/logout`   | None   | Logout, clear cookie |

**Register body:**

```json
{
  "email": "user@example.com",
  "username": "cooluser",
  "password": "password123",
  "selectedVibe": "SARCASTIC"
}
```

`username`: 3–30 chars, alphanumeric + underscores only. `selectedVibe` is optional.

**Login body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (register/login):**

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "...",
      "email": "...",
      "username": "...",
      "selectedVibe": "SARCASTIC"
    }
  }
}
```

The refresh token is set as an `httpOnly` cookie.

---

### News

All news endpoints require `Authorization: Bearer <token>`.

| Method   | Endpoint                   | Description                                      |
| -------- | -------------------------- | ------------------------------------------------ |
| `GET`    | `/news/feed`               | Personalized feed (scored + preference-weighted) |
| `GET`    | `/news/feed/fresh`         | Latest cards, no personalization                 |
| `GET`    | `/news/:id`                | Single card by ID                                |
| `GET`    | `/news/category/:category` | Cards filtered by category                       |
| `POST`   | `/news/interact`           | Log an interaction                               |
| `POST`   | `/news/save/:id`           | Save a card                                      |
| `DELETE` | `/news/saved/:id`          | Unsave a card                                    |
| `GET`    | `/news/saved`              | List saved cards                                 |
| `GET`    | `/news/:id/voice`          | Get TTS audio for a card (WAV)                   |

**Feed query params:** `page` (default `1`), `limit` (default `20`, max `50`)

**Interaction body:**

```json
{ "newsCardId": "<uuid>", "type": "SWIPE_RIGHT" }
```

Valid types: `SWIPE_RIGHT`, `SWIPE_LEFT`, `SAVED`, `VOICE_PLAYED`, `EXPANDED`, `REACTED`, `SHARED`

Valid categories: `TECH`, `CULTURE`, `WORLD`, `VIRAL`, `SCIENCE`, `FINANCE`

---

### User

All user endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint            | Description                    |
| ------ | ------------------- | ------------------------------ |
| `GET`  | `/user/me`          | Get current user profile       |
| `PUT`  | `/user/vibe`        | Update user's active vibe      |
| `GET`  | `/user/preferences` | Get category preference scores |
| `PUT`  | `/user/preferences` | Update preferences             |
| `GET`  | `/user/streak`      | Get current streak data        |
| `GET`  | `/user/stats`       | Get category affinity stats    |

**Update vibe body:**

```json
{ "vibe": "DRAMATIC" }
```

Valid vibes: `SARCASTIC`, `DRAMATIC`, `CONSPIRACY`, `AUNTY`

---

### AI

All AI endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint                 | Description                                  |
| ------ | ------------------------ | -------------------------------------------- |
| `GET`  | `/ai/vibe/:cardId/:vibe` | Get (or generate) vibe content for a card    |
| `POST` | `/ai/vibe/regenerate`    | Invalidate cache and regenerate vibe content |
| `GET`  | `/ai/summary/:cardId`    | Get AI-generated article summary             |
| `POST` | `/ai/explain`            | Explain a trend                              |

**Regenerate body:**

```json
{ "cardId": "<uuid>", "vibe": "CONSPIRACY" }
```

**Explain body:**

```json
{ "text": "explain NPC brain rot" }
```

---

### Admin

Admin endpoints require `X-Admin-Key: <ADMIN_SECRET_KEY>` header.

| Method | Endpoint                   | Description                    |
| ------ | -------------------------- | ------------------------------ |
| `POST` | `/admin/scrape/trigger`    | Trigger manual scrape pipeline |
| `GET`  | `/admin/scrape/status`     | Get latest scraper run status  |
| `GET`  | `/admin/cards/pending`     | List unapproved cards          |
| `POST` | `/admin/cards/approve/:id` | Approve a pending card         |

---

## Scraper Pipeline

Runs automatically every 6 hours via cron. Manual trigger via admin API.

1. Scrape RSS feeds (BBC, The Hindu, TechCrunch, The Verge, Vice)
2. Scrape Reddit (r/technology, r/worldnews, r/science, r/india, r/interestingasfuck, r/todayilearned)
3. Scrape YouTube trending (India) + Google Trends + Urban Dictionary
4. Normalize + deduplicate by URL hash
5. Score: `(ageScore × 0.4) + (engagementScore × 0.35) + (sourceWeight × 0.25)`
6. Filter: keep scores > 0.4
7. AI-enrich top items via Gemini (headline, summary, category, tags)
8. Upsert to PostgreSQL
9. Pre-generate all 4 vibe variants per card

---

## Vibe System

Each news card has 4 AI-generated vibe variants powered by Gemini:

| Vibe         | Personality                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| `SARCASTIC`  | Dry wit, exhausted internet brain                                            |
| `DRAMATIC`   | Movie-trailer energy, everything is of cosmic importance                     |
| `CONSPIRACY` | Shadowy elites, ends with _"...and THAT'S what they don't want you to know"_ |
| `AUNTY`      | Hinglish gossip auntie, very concerned, lots of tsk-tsking                   |

Vibe content is cached in Redis and lazily generated on first request if not pre-generated.

---

## Preference System

User preferences are tracked via an Exponential Moving Average (EMA) per category:

- Each interaction updates the score: `new = clamp(current + α × (delta − current), 0, 1)`
- α = 0.1 (slow drift, recent actions have more weight)
- Positive signals: `SWIPE_RIGHT` (+1), `SAVED` (+1), `SHARED` (+0.8), `EXPANDED` (+0.5), `VOICE_PLAYED` (+0.5), `REACTED` (+0.3)
- Negative signal: `SWIPE_LEFT` (−1)

---

## Running Tests

```bash
# All tests (with coverage)
npm test

# No coverage (faster)
npx jest --no-coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npx jest --watch
```

Test layout:

```
tests/
├── unit/
│   ├── preference.service.test.js   # EMA scoring + streak logic
│   ├── trendScore.test.js           # Trend score algorithm
│   └── vibe.service.test.js         # Vibe prompts structure
└── integration/
    ├── auth.routes.test.js          # Register/login/refresh/logout
    ├── news.routes.test.js          # Feed/interact/save endpoints
    └── ai.routes.test.js            # AI endpoints (Gemini mocked)
```

57 tests across 6 suites, all passing.

---

## Project Structure

```
contextcrash-backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── env.js              # Zod-validated env vars
│   │   ├── constants.js        # RSS sources, TTLs, score weights
│   │   ├── prisma.js           # Shared Prisma client instance
│   │   └── supabase.js         # Supabase client
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── news.controller.js
│   │   ├── user.controller.js
│   │   └── ai.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validate.middleware.js
│   ├── models/
│   │   ├── user.model.js
│   │   ├── newsCard.model.js
│   │   ├── interaction.model.js
│   │   └── vibeCache.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── news.routes.js
│   │   ├── user.routes.js
│   │   ├── ai.routes.js
│   │   ├── scraper.routes.js
│   │   └── index.js
│   ├── services/
│   │   ├── ai/
│   │   │   ├── google.service.js    # Gemini AI (vibe, summary, explain, enrich)
│   │   │   ├── voice.service.js     # Gemini TTS → WAV buffer
│   │   │   ├── vibe.service.js      # VIBE_PROMPTS + getVibeLabel
│   │   │   └── summarizer.service.js # ENRICHMENT_PROMPT
│   │   ├── scraper/
│   │   │   ├── rss.scraper.js
│   │   │   ├── reddit.scraper.js
│   │   │   ├── trending.scraper.js
│   │   │   ├── cleaner.js
│   │   │   └── index.js             # Pipeline orchestrator
│   │   ├── cache.service.js
│   │   ├── news.service.js
│   │   ├── preference.service.js
│   │   └── scheduler.service.js
│   ├── utils/
│   │   ├── logger.js
│   │   ├── asyncHandler.js
│   │   └── imageProxy.js
│   └── server.js
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── jest.config.js
├── package.json
└── README.md
```

---

## Cron Schedule

| Schedule          | Job                                          |
| ----------------- | -------------------------------------------- |
| Every 6 hours     | Full scrape pipeline                         |
| 6:00 AM IST daily | Daily brief generation                       |
| Midnight UTC      | Archive cards older than 7 days              |
| Every hour        | Cache cleanup hook                           |
| Every 30 minutes  | Vibe content backfill for any un-vibed cards |

---

## Credentials Checklist

Before running, you need:

- [ ] **PostgreSQL database** — `DATABASE_URL` (e.g. Supabase)
- [ ] **Redis instance** — `REDIS_URL` (e.g. Upstash or local)
- [ ] **Google Gemini API key** — `GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com)
- [ ] **YouTube Data API v3 key** — `YOUTUBE_API_KEY` from [Google Cloud Console](https://console.cloud.google.com)
- [ ] **JWT_SECRET** — any 32+ character random string
- [ ] **ADMIN_SECRET_KEY** — any random string for protecting admin routes
