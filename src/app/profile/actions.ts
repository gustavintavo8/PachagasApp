'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type ActionResult = { success: boolean; error?: string };

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()

    // 1. Verificar usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { error: 'No estás autenticado' }
    }

    // 2. Recoger datos
    const username = formData.get('username') as string
    const position = formData.get('position') as string
    const skill_level = formData.get('skill_level') as string
    const avatar_url = formData.get('avatar_url') as string // Asegúrate de que el front envíe esto si ha cambiado

    // 3. Validar datos mínimos
    if (!username || !position) {
        return { error: 'El nombre de usuario y la posición son obligatorios' }
    }

    // 4. ACTUALIZAR (Usar update, no upsert)
    const { error } = await supabase
        .from('profiles')
        .update({
            username,
            position,
            skill_level: parseInt(skill_level),
            // Solo actualizamos avatar si viene uno nuevo, si no, no lo tocamos
            ...(avatar_url && { avatar_url }),
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id) // ¡Importante! Asegurar que solo tocas TU fila

    if (error) {
        console.error('Error updating profile:', error)
        return { error: 'Error al actualizar el perfil. Inténtalo de nuevo.' }
    }

    revalidatePath('/profile')
    revalidatePath('/') // Para actualizar el avatar en el Navbar

    return { success: true }
}

export async function updateAvatar(path: string): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: path });

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
}
