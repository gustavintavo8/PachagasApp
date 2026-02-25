import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase admin client using the service role key.
 * This client bypasses Row Level Security (RLS) and should only
 * be used in server-side code for operations that need to update
 * rows belonging to other users (e.g., updating profile stats
 * for all match participants).
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
