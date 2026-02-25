"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    const username = formData.get("username") as string;
    const position = formData.get("position") as string;
    const skill_level = parseInt(formData.get("skill_level") as string, 10);

    const { error } = await supabase
        .from("profiles")
        .upsert({
            id: user.id,
            username,
            position,
            skill_level,
        });

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
}

export async function updateAvatar(path: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Not authenticated" };
    }

    const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: path });

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
}
