/**
 * Simple permission helpers for admin / organizer role checks.
 * Admin emails are hardcoded here — no database table needed.
 */

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
