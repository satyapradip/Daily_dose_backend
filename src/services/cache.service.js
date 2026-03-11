const Redis = require("ioredis");
const { env } = require("../config/env");
const { logger } = require("../utils/logger");

class CacheService {
  constructor() {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });

    this.client.on("connect", () => logger.info("Redis connected"));
    this.client.on("error", (err) =>
      logger.error("Redis error:", { error: err.message }),
    );
    this.client.on("close", () => logger.warn("Redis connection closed"));
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.quit();
  }

  async get(key) {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async set(key, value, ttlSeconds) {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key) {
    await this.client.del(key);
  }

  async exists(key) {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key, ttlSeconds) {
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key) {
    return this.client.ttl(key);
  }

  async acquireLock(key, ttlSeconds) {
    const result = await this.client.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async releaseLock(key) {
    await this.client.del(key);
  }

  async deleteByPattern(pattern) {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    const pipeline = this.client.pipeline();
    keys.forEach((k) => pipeline.del(k));
    await pipeline.exec();
    return keys.length;
  }

  async getOrSet(key, fetcher, ttlSeconds) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async ping() {
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
