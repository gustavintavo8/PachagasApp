"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type ActionResult = { success: boolean; error?: string };

export async function login(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { success: false, error: "Email and password are required" };
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
        return { success: false, error: "Email and password are required" };
    }

    if (password.length < 6) {
        return { success: false, error: "Password must be at least 6 characters" };
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        return { success: false, error: error.message };
    }

    redirect("/profile");
}

export async function signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
}
