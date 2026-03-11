const Redis = require("ioredis");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

class CacheService {
  constructor() {
    this.available = false;

    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        // Stop retrying after 3 attempts; server should not crash without Redis
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    this.client.on("ready", () => {
      this.available = true;
      logger.info("Redis connected");
    });
    this.client.on("error", (err) => {
      this.available = false;
      logger.error("Redis error:", { error: err.message });
    });
    this.client.on("close", () => {
      this.available = false;
      logger.warn("Redis connection closed");
    });

    // Attempt connection but do not let failure crash the process
    this.client.connect().catch((err) => {
      logger.warn(`Redis unavailable – caching disabled: ${err.message}`);
    });
  }

  async connect() {
    if (!this.available) return;
    await this.client.connect();
  }

  async disconnect() {
    if (!this.available) return;
    await this.client.quit();
  }

  async get(key) {
    if (!this.available) return null;
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSeconds) {
    if (!this.available) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch {
      // ignore cache write failures
    }
  }

  async del(key) {
    if (!this.available) return;
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }

  async exists(key) {
    if (!this.available) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async expire(key, ttlSeconds) {
    if (!this.available) return;
    try {
      await this.client.expire(key, ttlSeconds);
    } catch {
      /* ignore */
    }
  }

  async ttl(key) {
    if (!this.available) return -1;
    try {
      return this.client.ttl(key);
    } catch {
      return -1;
    }
  }

  async acquireLock(key, ttlSeconds) {
    if (!this.available) return true; // allow operation when cache is down
    try {
      const result = await this.client.set(key, "1", "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch {
      return true;
    }
  }

  async releaseLock(key) {
    if (!this.available) return;
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }

  async deleteByPattern(pattern) {
    if (!this.available) return 0;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      const pipeline = this.client.pipeline();
      keys.forEach((k) => pipeline.del(k));
      await pipeline.exec();
      return keys.length;
    } catch {
      return 0;
    }
  }

  async getOrSet(key, fetcher, ttlSeconds) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async ping() {
    if (!this.available) return false;
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  getClient() {
    return this.client;
  }
}

const cacheService = new CacheService();

module.exports = { cacheService };
