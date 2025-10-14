interface CacheEntry {
    url: string;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Retrieves a URL from the cache if it exists and has not expired.
 * @param key The cache key, typically the storage path of the image.
 * @returns The cached URL or null if not found or expired.
 */
export const getFromCache = (key: string): string | null => {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.url;
    }
    // If entry exists but is expired, remove it
    if (entry) {
        cache.delete(key);
    }
    return null;
};

/**
 * Adds a URL to the cache with an expiration time.
 * @param key The cache key, typically the storage path of the image.
 * @param url The URL to cache.
 * @param ttlSeconds The time-to-live for the cache entry in seconds.
 */
export const setInCache = (key: string, url: string, ttlSeconds: number): void => {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    cache.set(key, { url, expiresAt });
};

/**
 * Clears the entire cache.
 */
export const clearCache = (): void => {
    cache.clear();
};