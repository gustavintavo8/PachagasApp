import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Extract name from OAuth metadata
            const meta = data.user.user_metadata;
            const username =
                meta?.full_name ||
                meta?.name ||
                meta?.preferred_username ||
                data.user.email?.split("@")[0] ||
                "Jugador";
            const avatarUrl = meta?.avatar_url || meta?.picture || null;
            const email = data.user.email;

            // Use admin client to bypass RLS and perform an upsert
            const adminClient = createAdminClient();

            // We use upsert so that if a DB trigger already created the basic row,
            // we overwrite it with the rich Google data (name, avatar, email)
            const { error: upsertError } = await adminClient.from("profiles").upsert({
                id: data.user.id,
                username,
                avatar_url: avatarUrl,
                email: email, // Save the email if the column exists
                position: null,
                skill_level: 5,
                matches_played: 0,
                goals_scored: 0,
            }, { onConflict: 'id' });

            if (upsertError) {
                console.error("Error upserting profile:", upsertError);
            }

            return NextResponse.redirect(`${origin}/`);
        }
    }

    return NextResponse.redirect(`${origin}/login`);
}
