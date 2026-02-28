import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Check if profile exists, if not create it
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", data.user.id)
                .single();

            if (!existingProfile) {
                // Extract name from OAuth metadata
                const meta = data.user.user_metadata;
                const username =
                    meta?.full_name ||
                    meta?.name ||
                    meta?.preferred_username ||
                    data.user.email?.split("@")[0] ||
                    "Jugador";
                const avatarUrl = meta?.avatar_url || meta?.picture || null;

                await supabase.from("profiles").insert({
                    id: data.user.id,
                    username,
                    avatar_url: avatarUrl,
                    position: null,
                    skill_level: 5,
                    matches_played: 0,
                    goals_scored: 0,
                });
            }

            return NextResponse.redirect(`${origin}/`);
        }
    }

    return NextResponse.redirect(`${origin}/login`);
}
