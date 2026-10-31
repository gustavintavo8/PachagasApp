"use server";

import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/types";

const BUCKET_FOTOS = "match_photos";

/**
 * La ruta de una foto propia, sacada de su URL pública. photo_url la escribe el cliente,
 * así que solo vale lo que tenga la forma de lo que sube MatchPhotos: <partido>/<usuario>-<fecha>.<ext>.
 */
function rutaDeFotoPropia(url: string, uid: string): string | null {
    try {
        const ruta = decodeURIComponent(url.split(`/${BUCKET_FOTOS}/`)[1]?.split("?")[0] ?? "");
        const [partido, fichero, ...sobra] = ruta.split("/");
        return partido && fichero?.startsWith(`${uid}-`) && sobra.length === 0 ? ruta : null;
    } catch {
        return null;
    }
}

async function borrarFicheros(admin: ReturnType<typeof createAdminClient>, bucket: string, rutas: string[]) {
    if (rutas.length === 0) return;
    const { error } = await admin.storage.from(bucket).remove(rutas);
    // La cuenta ya no está: se avisa en el log, pero no al usuario
    if (error) console.error("[data-actions] deleteAccount storage error:", bucket, error.message);
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
    const [avatares, fotos, mvps] = await Promise.all([
        admin.storage.from("avatars").list(currentUser.id, { limit: 1000 }),
        admin.from(BUCKET_FOTOS).select("photo_url").eq("user_id", currentUser.id),
        admin.from("match_participants").select("match_id").eq("user_id", currentUser.id).eq("is_mvp", true),
    ]);
    if (avatares.error || fotos.error || mvps.error) {
        return { success: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };
    }

    // Borra el usuario de auth.users; el ON DELETE CASCADE limpia profiles y todo lo dependiente.
    const { error } = await admin.auth.admin.deleteUser(currentUser.id);
    if (error) return { success: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };

    await Promise.all([
        borrarFicheros(admin, "avatars", avatares.data.map((f) => `${currentUser.id}/${f.name}`)),
        borrarFicheros(admin, BUCKET_FOTOS, fotos.data.flatMap((f) => rutaDeFotoPropia(f.photo_url, currentUser.id) ?? [])),
    ]);

    // Sin su fila, un partido resuelto parecería sin resolver y los votos que quedan elegirían a otro MVP
    if (mvps.data.length > 0) {
        await admin.from("mvp_votes").delete().in("match_id", mvps.data.map((m) => m.match_id));
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
