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
    let { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    if (createError) {
        // Handle duplicate: user exists in auth.users but maybe not in profiles (deleted manually)
        if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
            // Check if they have a profile
            const { data: users } = await adminClient.auth.admin.listUsers();
            const existingUser = users?.users?.find((u) => u.email === email);

            if (existingUser) {
                const { data: existingProfile } = await adminClient
                    .from("profiles")
                    .select("id")
                    .eq("id", existingUser.id)
                    .single();

                if (!existingProfile) {
                    // Orphaned auth user — delete and retry
                    await adminClient.auth.admin.deleteUser(existingUser.id);

                    const { data: retryUser, error: retryError } = await adminClient.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                    });

                    if (retryError) {
                        return { success: false, error: retryError.message };
                    }

                    newUser = retryUser;
                } else {
                    return { success: false, error: "Este email ya está registrado. Inicia sesión." };
                }
            } else {
                return { success: false, error: "Este email ya está registrado. Inicia sesión." };
            }
        } else {
            return { success: false, error: createError.message };
        }
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
