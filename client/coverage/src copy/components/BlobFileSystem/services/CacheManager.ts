/**
 * Simple cache implementation to reduce redundant API calls
 */
export class CacheManager<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map();
  private readonly defaultTtl: number;

  constructor(defaultTtlMs: number = 30000) { // Default 30 seconds TTL
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Retrieves an item from cache
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if item is expired
    if (Date.now() - item.timestamp > this.defaultTtl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * Stores an item in cache
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Removes an item from cache
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Removes all items from cache
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Invalidates all cache items that match a prefix
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}
