"use server";

import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/types";

/** Lo que va detrás del nombre del bucket en la URL pública. */
function rutaEnBucket(url: string, bucket: string): string | null {
    const [, ruta] = url.split(`/${bucket}/`);
    return ruta ? decodeURIComponent(ruta.split("?")[0]) : null;
}

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

    const admin = createAdminClient();

    // El cascade no llega a los ficheros, y se lleva las filas que dicen cuáles son: se leen antes.
    const [{ data: avatares }, { data: fotos }] = await Promise.all([
        admin.storage.from("avatars").list(currentUser.id, { limit: 1000 }),
        admin.from("match_photos").select("photo_url").eq("user_id", currentUser.id),
    ]);

    // Borra el usuario de auth.users; el ON DELETE CASCADE limpia profiles y todo lo dependiente.
    const { error } = await admin.auth.admin.deleteUser(currentUser.id);
    if (error) return { success: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };

    // La cuenta ya no está: si esto falla se avisa en el log, pero no al usuario.
    const borrados = await Promise.all([
        admin.storage.from("avatars").remove((avatares ?? []).map((f) => `${currentUser.id}/${f.name}`)),
        admin.storage
            .from("match_photos")
            .remove((fotos ?? []).flatMap((f) => rutaEnBucket(f.photo_url, "match_photos") ?? [])),
    ]);
    for (const { error: errorFichero } of borrados) {
        if (errorFichero) console.error("[data-actions] deleteAccount storage error:", errorFichero.message);
    }

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

    const [profile, participations, comments, photos, votes, notifications, rp, fantasy] =
        await Promise.all([
            admin.from("profiles").select("*").eq("id", uid).maybeSingle(),
            admin.from("match_participants").select("*").eq("user_id", uid),
            admin.from("match_comments").select("*").eq("user_id", uid),
            admin.from("match_photos").select("*").eq("user_id", uid),
            admin.from("mvp_votes").select("*").eq("voter_id", uid),
            admin.from("notifications").select("*").eq("user_id", uid),
            admin.from("rp_history").select("*").eq("user_id", uid),
            admin.from("fantasy_teams").select("*").eq("user_id", uid),
        ]);

    const queryResults = {
        profile,
        participations,
        comments,
        photos,
        votes,
        notifications,
        rp,
        fantasy,
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
        fantasy_teams: fantasy.data ?? [],
    };

    return { success: true, data: JSON.stringify(exportObject, null, 2) };
}
