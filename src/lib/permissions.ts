/**
 * Simple permission helpers for admin / organizer role checks.
 * Admin emails are hardcoded here — no database table needed.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS: string[] = ["gustavintavo1202@gmail.com"];

/** Returns true if the given email belongs to a super-admin. */
export function isAdmin(email?: string | null): boolean {
    return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Returns true if the user can manage the given match.
 * "Manage" means: the user is either admin or the match organizer.
 */
export function canManageMatch(
    userEmail: string | undefined | null,
    userId: string,
    matchCreatedBy: string
): boolean {
    return isAdmin(userEmail) || userId === matchCreatedBy;
}

/**
 * Returns the user IDs of all admin users.
 * Resolves admin emails to Supabase auth user IDs.
 * Cached per server process to avoid repeated lookups.
 */
let cachedAdminIds: string[] | null = null;

export async function getAdminUserIds(): Promise<string[]> {
    if (cachedAdminIds) return cachedAdminIds;

    const admin = createAdminClient();
    const ids: string[] = [];

    for (const email of ADMIN_EMAILS) {
        const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
        if (data?.users) {
            const match = data.users.find(
                (u) => u.email?.toLowerCase() === email.toLowerCase()
            );
            if (match) ids.push(match.id);
        }
    }

    cachedAdminIds = ids;
    return cachedAdminIds;
}
