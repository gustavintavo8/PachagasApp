"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: boolean; error?: string };

export async function updateProfile(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    const username = formData.get("username") as string;
    const position = formData.get("position") as string;
    const skill_level = parseInt(formData.get("skill_level") as string, 10);

    if (!username || username.trim().length < 2) {
        return { success: false, error: "Nickname must be at least 2 characters" };
    }

    if (!["GK", "DEF", "MID", "FWD"].includes(position)) {
        return { success: false, error: "Please select a valid position" };
    }

    if (isNaN(skill_level) || skill_level < 1 || skill_level > 10) {
        return { success: false, error: "Skill level must be between 1 and 10" };
    }

    const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        username: username.trim(),
        position,
        skill_level,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
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
