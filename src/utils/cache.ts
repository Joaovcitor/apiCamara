import NodeCache from 'node-cache';
import { logger } from './logger';

class CacheManager {
  private cache: NodeCache;
  private defaultTTL: number;

  constructor() {
    this.defaultTTL = parseInt(process.env['CACHE_TTL'] ?? '3600', 10);
    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false,
    });

    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`, { size: JSON.stringify(value).length });
    });

    this.cache.on('del', key => {
      logger.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`, { size: JSON.stringify(value).length });
    });
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      return this.cache.set(key, value, ttl ?? this.defaultTTL);
    } catch (error) {
      logger.error('Error setting cache', error);
      return false;
    }
  }

  get<T>(key: string): T | undefined {
    try {
      return this.cache.get<T>(key);
    } catch (error) {
      logger.error('Error getting from cache', error);
      return undefined;
    }
  }

  del(key: string): number {
    try {
      return this.cache.del(key);
    } catch (error) {
      logger.error('Error deleting from cache', error);
      return 0;
    }
  }

  has(key: string): boolean {
    try {
      return this.cache.has(key);
    } catch (error) {
      logger.error('Error checking cache', error);
      return false;
    }
  }

  flush(): void {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Error flushing cache', error);
    }
  }

  getStats(): NodeCache.Stats {
    return this.cache.getStats();
  }

  // Generate cache key for URLs
  generateUrlKey(url: string): string {
    return `scraping:${Buffer.from(url).toString('base64')}`;
  }

  // Generate cache key for files
  generateFileKey(filename: string, size: number): string {
    return `upload:${filename}:${size}`;
  }
}

export const cacheManager = new CacheManager();