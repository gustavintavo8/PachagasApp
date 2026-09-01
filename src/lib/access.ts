import "server-only";

import { timingSafeEqual } from "node:crypto";

import { hasActiveCommunityAccessGrant, isAdmin, isGuestUser, COMMUNITY_ACCESS_GRANT_SELECT, type CommunityAccessGrant } from "@/lib/permissions";
import { ensureSeasonPlayerStats, getActiveSeason, SeasonNotFoundError } from "@/lib/seasons";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAccessCode } from "@/lib/season-validation";
import type { ActionResult } from "@/lib/types";

const INVALID_ACCESS_CODE_ERROR = "Código de acceso inválido";
const COMMUNITY_ACCESS_REQUIRED_ERROR = "Necesitas acceso a la comunidad para continuar";
const COMMUNITY_ACCESS_REDEEM_ERROR = "No se pudo activar el acceso. Inténtalo de nuevo.";

function accessCodeMatches(code: string): boolean {
    const configuredCode = normalizeAccessCode(process.env.PACHANGA_ACCESS_CODE ?? "");
    const submittedCode = normalizeAccessCode(code);

    if (!configuredCode) {
        return false;
    }

    const configuredBuffer = Buffer.from(configuredCode);
    const submittedBuffer = Buffer.from(submittedCode);

    if (configuredBuffer.length !== submittedBuffer.length) {
        return false;
    }

    return timingSafeEqual(configuredBuffer, submittedBuffer);
}

export async function hasCommunityAccess(userId: string): Promise<boolean> {
    if (await isAdmin(userId)) {
        return true;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("community_access_grants")
        .select(COMMUNITY_ACCESS_GRANT_SELECT)
        .eq("user_id", userId)
        .maybeSingle<CommunityAccessGrant>();

    if (error) {
        return false;
    }

    return hasActiveCommunityAccessGrant(data);
}

export async function requireCommunityAccess(
    user: { id: string; is_anonymous?: boolean }
): Promise<ActionResult<true>> {
    if (!user.id || isGuestUser(user)) {
        return { success: false, error: "No autenticado" };
    }

    if (!(await hasCommunityAccess(user.id))) {
        return { success: false, error: COMMUNITY_ACCESS_REQUIRED_ERROR };
    }

    return { success: true, data: true };
}

export async function redeemAccessCode(code: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || isGuestUser(user)) {
        return { success: false, error: "No autenticado" };
    }

    const { allowed } = await rateLimit(
        `redeem-community-access:${user.id}`,
        5,
        60_000
    );
    if (!allowed) {
        return { success: false, error: COMMUNITY_ACCESS_REDEEM_ERROR };
    }

    if (!accessCodeMatches(code)) {
        return { success: false, error: INVALID_ACCESS_CODE_ERROR };
    }

    try {
        const activeSeason = await getActiveSeason();
        await ensureSeasonPlayerStats(activeSeason.id, user.id);
    } catch (seasonError) {
        if (seasonError instanceof SeasonNotFoundError) {
            return { success: false, error: seasonError.message };
        }

        return { success: false, error: COMMUNITY_ACCESS_REDEEM_ERROR };
    }

    const admin = createAdminClient();
    const { error } = await admin.from("community_access_grants").upsert(
        {
            user_id: user.id,
            granted_at: new Date().toISOString(),
            revoked_at: null,
        },
        {
            onConflict: "user_id",
        }
    );

    if (error) {
        return { success: false, error: COMMUNITY_ACCESS_REDEEM_ERROR };
    }

    return { success: true, data: undefined };
}
