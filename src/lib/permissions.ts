/**
 * Permission helpers for admin / organizer role checks.
 * Admin status is read from the `is_admin` column in the `profiles` table.
 * This column is NOT modifiable by the user via RLS (enforced by a DB trigger).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns true if the currently authenticated user is a super-admin.
 * Reads the `is_admin` flag from their profile row.
 * Use this in Server Actions where you already have a supabase session.
 */
export async function isAdmin(userId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();

    if (error || !data) return false;
    return data.is_admin === true;
}

/**
 * Returns true if the user can manage the given match.
 * "Manage" means: the user is either admin or the match organizer.
 */
export async function canManageMatch(
    userId: string,
    matchCreatedBy: string
): Promise<boolean> {
    if (userId === matchCreatedBy) return true;
    return isAdmin(userId);
}

/**
 * Returns the user IDs of all admin users by querying the profiles table.
 */
export async function getAdminUserIds(): Promise<string[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
        .from("profiles")
        .select("id")
        .eq("is_admin", true);

    if (error || !data) return [];
    return data.map((p) => p.id);
}

/**
 * Returns true if the user is an anonymous (guest) session.
 * Anonymous users have is_anonymous: true in their JWT.
 */
export function isGuestUser(user: { is_anonymous?: boolean } | null): boolean {
    return user?.is_anonymous === true;
}
