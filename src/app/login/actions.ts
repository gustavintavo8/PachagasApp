"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

type ActionResult = { success: boolean; error?: string; message?: string };

export async function login(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email y contraseña son obligatorios" };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        if (error.message === "Email not confirmed") {
            return { success: false, error: "Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada." };
        }
        return { success: false, error: error.message };
    }

    redirect("/");
}

export async function signup(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();
    const headersList = await headers();
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email y contraseña son obligatorios" };
    }

    if (password.length < 6) {
        return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
    }

    // Clean up orphaned auth users (exist in auth but not in profiles — e.g. deleted during testing)
    const adminClient = createAdminClient();
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const orphan = existingUsers?.users?.find((u) => u.email === email);
    if (orphan) {
        const { data: orphanProfile } = await adminClient
            .from("profiles")
            .select("id")
            .eq("id", orphan.id)
            .single();

        if (!orphanProfile) {
            await adminClient.auth.admin.deleteUser(orphan.id);
        }
    }

    // Sign up — sends confirmation email via configured SMTP
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        if (error.message?.includes("already been registered") || error.message?.includes("already exists")) {
            return { success: false, error: "Este email ya está registrado. Inicia sesión." };
        }
        return { success: false, error: error.message };
    }

    return {
        success: true,
        message: "¡Cuenta creada! Revisa tu email y haz click en el enlace de confirmación para activar tu cuenta.",
    };
}

export async function signInWithOAuth(provider: "google" | "apple"): Promise<{ url?: string; error?: string }> {
    const supabase = await createClient();
    const headersList = await headers();
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    });

    if (error) {
        return { error: error.message };
    }

    return { url: data.url };
}

export async function signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
}
