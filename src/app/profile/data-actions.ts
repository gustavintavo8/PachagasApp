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
