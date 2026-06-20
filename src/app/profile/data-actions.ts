"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGuestUser } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/types";

export async function deleteAccount(): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "No estás autenticado" };
    if (isGuestUser(user)) return { success: false, error: "Acción no disponible en modo demo" };

    const { allowed } = await rateLimit(`delete-account:${user.id}`, 3, 3_600_000);
    if (!allowed) return { success: false, error: "Demasiados intentos. Espera un momento." };

    // Borra el usuario de auth.users; el ON DELETE CASCADE limpia profiles y todo lo dependiente.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { success: false, error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." };

    await supabase.auth.signOut();
    return { success: true, data: undefined };
}

export async function exportMyData(): Promise<ActionResult<string>> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "No estás autenticado" };
    if (isGuestUser(user)) return { success: false, error: "Acción no disponible en modo demo" };

    const { allowed } = await rateLimit(`export-data:${user.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas descargas. Espera un momento." };

    const admin = createAdminClient();
    const uid = user.id;

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

    const exportObject = {
        exported_at: new Date().toISOString(),
        account: { id: uid, email: user.email },
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
