/**
 * Simple in-memory rate limiter using token bucket algorithm.
 * Note: This resets on server restart and is per-instance only.
 * For production, use Redis or a distributed rate limiter.
 */

interface BucketEntry {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, BucketEntry>();

export function rateLimit(
    key: string,
    maxTokens: number = 10,
    refillIntervalMs: number = 60_000
): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry) {
        entry = { tokens: maxTokens - 1, lastRefill: now };
        buckets.set(key, entry);
        return { allowed: true, remaining: entry.tokens };
    }

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill;
    const refillCount = Math.floor(elapsed / refillIntervalMs) * maxTokens;
    if (refillCount > 0) {
        entry.tokens = Math.min(maxTokens, entry.tokens + refillCount);
        entry.lastRefill = now;
    }

    if (entry.tokens <= 0) {
        return { allowed: false, remaining: 0 };
    }

    entry.tokens--;
    return { allowed: true, remaining: entry.tokens };
}

// Periodic cleanup of old entries (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    const STALE_MS = 10 * 60 * 1000; // 10 minutes
    for (const [key, entry] of buckets.entries()) {
        if (now - entry.lastRefill > STALE_MS) {
            buckets.delete(key);
        }
    }
}, 5 * 60 * 1000);
