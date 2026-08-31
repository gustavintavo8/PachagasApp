'use server'

import { requireCommunityAccess } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import type { ActionResult } from "@/lib/types";

const UpdateProfileSchema = z.object({
    username: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(30, "Máximo 30 caracteres"),
    position: z.enum(["GK", "DEF", "MID", "FWD"], { message: "Posición inválida" }),
    avatar_url: z.string().optional(),
});

async function requireProfileAccess(
    user: { id: string; is_anonymous?: boolean } | null,
    unauthenticatedError: string
): Promise<ActionResult<true>> {
    if (!user || user.is_anonymous === true) {
        return { success: false, error: unauthenticatedError };
    }

    return requireCommunityAccess(user);
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) return { success: false, error: 'No estás autenticado' }

    const access = await requireProfileAccess(user, 'No estás autenticado')
    if (!access.success) return access;
    const currentUser = user!

    const { allowed } = await rateLimit(`update-profile:${currentUser.id}`, 5, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas actualizaciones. Espera un momento." };

    const parsed = UpdateProfileSchema.safeParse({
        username: formData.get('username'),
        position: formData.get('position'),
        avatar_url: formData.get('avatar_url') ?? undefined,
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { username, position, avatar_url } = parsed.data;

    const { error } = await supabase
        .from('profiles')
        .update({
            username,
            position,
            ...(avatar_url && { avatar_url }),
            updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

    if (error) {
        return { success: false, error: 'Error al actualizar el perfil. Inténtalo de nuevo.' }
    }

    revalidatePath('/profile')
    revalidatePath('/')

    return { success: true, data: undefined }
}

export async function updateAvatar(path: string): Promise<ActionResult> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) return { success: false, error: "No autenticado" };

    const access = await requireProfileAccess(user, "No autenticado");
    if (!access.success) return access;
    const currentUser = user!;

    const { allowed } = await rateLimit(`update-avatar:${currentUser.id}`, 10, 60_000);
    if (!allowed) return { success: false, error: "Demasiadas subidas. Espera un momento." };

    const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", currentUser.id);

    if (error) {
        return { success: false, error: "Error al guardar el avatar." };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true, data: undefined };
}
