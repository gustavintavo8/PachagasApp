"use server";

import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/types";

async function requireProfileDataAccess(
    user: { id: string; is_anonymous?: boolean } | null
): Promise<ActionResult<true>> {
    if (!user || user.is_anonymous === true) {
        return { success: false, error: "No estás autenticado" };
    }

    return requireCommunityAccess(user);
}

export async function deleteAccount(): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) return { success: false, error: "No estás autenticado" };

    const access = await requireProfileDataAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`delete-account:${currentUser.id}`, 3, 3_600_000);
    if (!allowed) return { success: false, error: "Demasiados intentos. Espera un momento." };

    // Borra el usuario de auth.users; el ON DELETE CASCADE limpia profiles y todo lo dependiente.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(currentUser.id);
    if (error) return { success: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };

    await supabase.auth.signOut();
    return { success: true, data: undefined };
}

export async function exportMyData(): Promise<ActionResult<string>> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) return { success: false, error: "No estás autenticado" };

    const access = await requireProfileDataAccess(user);
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`export-data:${currentUser.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas descargas. Espera un momento." };

    const admin = createAdminClient();
    const uid = currentUser.id;

    const [profile, participations, comments, photos, votes, notifications, rp] =
        await Promise.all([
            admin.from("profiles").select("*").eq("id", uid).maybeSingle(),
            admin.from("match_participants").select("*").eq("user_id", uid),
            admin.from("match_comments").select("*").eq("user_id", uid),
            admin.from("match_photos").select("*").eq("user_id", uid),
            admin.from("mvp_votes").select("*").eq("voter_id", uid),
            admin.from("notifications").select("*").eq("user_id", uid),
            admin.from("rp_history").select("*").eq("user_id", uid),
        ]);

    const queryResults = {
        profile,
        participations,
        comments,
        photos,
        votes,
        notifications,
        rp,
    };
    const failedQueries = Object.entries(queryResults).filter(([, result]) => result.error);

    if (failedQueries.length > 0) {
        for (const [name, result] of failedQueries) {
            console.error(
                "[data-actions] exportMyData error:",
                name,
                result.error?.code,
                result.error?.message,
                "userId:",
                uid,
            );
        }
        return { success: false, error: "No se pudo generar tu exportación de datos. Inténtalo de nuevo." };
    }

    const exportObject = {
        exported_at: new Date().toISOString(),
        account: { id: uid, email: currentUser.email },
        profile: profile.data ?? null,
        participations: participations.data ?? [],
        comments: comments.data ?? [],
        photos: photos.data ?? [],
        mvp_votes: votes.data ?? [],
        notifications: notifications.data ?? [],
        rp_history: rp.data ?? [],
    };

    return { success: true, data: JSON.stringify(exportObject, null, 2) };
}
