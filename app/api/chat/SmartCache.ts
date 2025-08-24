/**
 * Smart Cache for AI Analysis Responses
 * Implements intelligent caching based on data freshness and request patterns
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  dataHash: string;
  type: 'transaction' | 'block';
}

export class SmartCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 1000; // Maximum cache entries
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes for most data
  private readonly blockTTL = 30 * 60 * 1000; // 30 minutes for confirmed blocks
  private readonly transactionTTL = 60 * 60 * 1000; // 1 hour for confirmed transactions
  
  /**
   * Generate cache key for transaction analysis
   */
  static getTransactionKey(txHash: string, chainId: number): string {
    return `tx_${chainId}_${txHash}`;
  }
  
  /**
   * Generate cache key for block analysis
   */
  static getBlockKey(blockNumber: number | string, chainId: number): string {
    return `block_${chainId}_${blockNumber}`;
  }
  
  /**
   * Generate data hash for cache invalidation
   */
  private generateDataHash(data: any): string {
    return JSON.stringify(data).length.toString(); // Simple hash based on data size
  }
  
  /**
   * Get cached analysis result
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    const ttl = this.getTTL(entry.type, entry.timestamp);
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      console.log(`🗑️ Cache expired for ${key}`);
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    console.log(`⚡ Cache hit for ${key} (accessed ${entry.accessCount} times)`);
    return entry.data;
  }
  
  /**
   * Set analysis result in cache
   */
  set(key: string, data: any, type: 'transaction' | 'block'): void {
    // Clean up cache if it's getting too large
    if (this.cache.size >= this.maxSize) {
      this.evictOldEntries();
    }
    
    const dataHash = this.generateDataHash(data);
    const now = Date.now();
    
    // Check if we're updating existing entry with same data
    const existingEntry = this.cache.get(key);
    if (existingEntry && existingEntry.dataHash === dataHash) {
      // Just update timestamp for same data
      existingEntry.timestamp = now;
      existingEntry.lastAccessed = now;
      console.log(`🔄 Refreshed cache timestamp for ${key}`);
      return;
    }
    
    // Create new cache entry
    const entry: CacheEntry = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      dataHash,
      type
    };
    
    this.cache.set(key, entry);
    console.log(`💾 Cached ${type} analysis: ${key} (${data ? Object.keys(data).length : 0} properties)`);
  }
  
  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const ttl = this.getTTL(entry.type, entry.timestamp);
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get appropriate TTL based on data type and age
   */
  private getTTL(type: 'transaction' | 'block', timestamp: number): number {
    const age = Date.now() - timestamp;
    
    if (type === 'transaction') {
      // Recent transactions get shorter TTL, older ones longer
      if (age < 10 * 60 * 1000) { // Less than 10 minutes old
        return this.defaultTTL; // 5 minutes
      } else {
        return this.transactionTTL; // 1 hour for confirmed transactions
      }
    } else {
      // Blocks
      if (age < 30 * 60 * 1000) { // Less than 30 minutes old
        return this.defaultTTL; // 5 minutes for recent blocks
      } else {
        return this.blockTTL; // 30 minutes for confirmed blocks
      }
    }
  }
  
  /**
   * Evict least recently used entries when cache is full
   */
  private evictOldEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
    }
    
    console.log(`🧹 Evicted ${toRemove} old cache entries`);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const avgAccess = entries.length > 0 ? totalAccess / entries.length : 0;
    
    const typeStats = entries.reduce((stats, entry) => {
      stats[entry.type] = (stats[entry.type] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalAccess,
      averageAccessPerEntry: Math.round(avgAccess * 100) / 100,
      typeBreakdown: typeStats,
      hitRate: this.getHitRate()
    };
  }
  
  /**
   * Track hit rate for performance monitoring
   */
  private hitRate = { hits: 0, misses: 0 };
  
  private recordHit(): void {
    this.hitRate.hits++;
  }
  
  private recordMiss(): void {
    this.hitRate.misses++;
  }
  
  private getHitRate(): number {
    const total = this.hitRate.hits + this.hitRate.misses;
    return total > 0 ? (this.hitRate.hits / total) * 100 : 0;
  }
  
  /**
   * Enhanced get method with hit/miss tracking
   */
  getWithTracking(key: string): any | null {
    const result = this.get(key);
    
    if (result !== null) {
      this.recordHit();
    } else {
      this.recordMiss();
    }
    
    return result;
  }
  
  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): number {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => pattern.test(key));
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
    console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries matching pattern`);
    return keysToDelete.length;
  }
  
  /**
   * Preload data into cache (useful for commonly accessed items)
   */
  preload(key: string, data: any, type: 'transaction' | 'block'): void {
    this.set(key, data, type);
    console.log(`📥 Preloaded ${type} into cache: ${key}`);
  }
  
  /**
   * Get all keys in cache (useful for debugging)
   */
  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Clean expired entries manually
   */
  cleanExpired(): number {
    const initialSize = this.cache.size;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const ttl = this.getTTL(entry.type, entry.timestamp);
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
      }
    }
    
    const cleaned = initialSize - this.cache.size;
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
    
    return cleaned;
  }
}