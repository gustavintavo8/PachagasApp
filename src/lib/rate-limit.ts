import { createAdminClient } from "@/lib/supabase/admin";

export async function rateLimit(
    key: string,
    maxTokens: number = 10,
    refillIntervalMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
    try {
        const admin = createAdminClient();
        const { data, error } = await admin.rpc("consume_rate_limit", {
            p_key: key,
            p_max_tokens: maxTokens,
            p_refill_interval_ms: refillIntervalMs
        });

        if (error) {
            return { allowed: false, remaining: 0 };
        }

        return { allowed: data === true, remaining: 0 };
    } catch {
        return { allowed: false, remaining: 0 };
    }
}
