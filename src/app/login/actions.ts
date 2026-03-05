"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

type ActionResult = { success: boolean; error?: string };

export async function login(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email y contraseña son obligatorios" };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return { success: false, error: error.message };
    }

    redirect("/");
}

export async function signup(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email y contraseña son obligatorios" };
    }

    if (password.length < 6) {
        return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
    }

    const adminClient = createAdminClient();
    const username = email.split("@")[0];

    // Create user via admin API — no confirmation email, no rate limits
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    if (createError) {
        // Handle duplicate email
        if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
            return { success: false, error: "Este email ya está registrado. Inicia sesión." };
        }
        return { success: false, error: createError.message };
    }

    // Create profile
    if (newUser.user) {
        const { error: profileError } = await adminClient.from("profiles").upsert({
            id: newUser.user.id,
            username,
            email,
            position: "MID",
            skill_level: 5,
            matches_played: 0,
            goals_scored: 0,
        }, { onConflict: "id" });

        if (profileError) {
            console.error("Error creating profile:", profileError);
        }
    }

    // Sign in to create a session
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
        return { success: false, error: signInError.message };
    }

    redirect("/");
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
