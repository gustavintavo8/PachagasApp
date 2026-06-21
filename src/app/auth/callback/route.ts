import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const protocol = request.headers.get("x-forwarded-proto") || url.protocol;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
    const origin = `${protocol}://${host}`;
    const code = searchParams.get("code");

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Check if profile exists
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", data.user.id)
                .single();

            const meta = data.user.user_metadata;
            const googleUsername =
                meta?.full_name ||
                meta?.name ||
                meta?.preferred_username ||
                data.user.email?.split("@")[0] ||
                "Jugador";
            const googleAvatarUrl = meta?.avatar_url || meta?.picture || null;

            const adminClient = createAdminClient();

            if (!existingProfile) {
                // User has no profile at all, create it
                await adminClient.from("profiles").insert({
                    id: data.user.id,
                    username: googleUsername,
                    avatar_url: googleAvatarUrl,
                    position: "MID",
                    skill_level: 5,
                    matches_played: 0,
                    goals_scored: 0,
                    accepted_privacy_version: PRIVACY_POLICY_VERSION,
                    accepted_privacy_at: new Date().toISOString(),
                });
            } else {
                // Profile exists. Only update if it's an empty/default profile (e.g. created by DB trigger)
                // We check if matches_played is 0 and there's no custom avatar yet
                if (existingProfile.matches_played === 0 && !existingProfile.avatar_url) {
                    await adminClient.from("profiles").update({
                        username: existingProfile.username && existingProfile.username !== "Jugador" ? existingProfile.username : googleUsername,
                        avatar_url: googleAvatarUrl,
                    }).eq("id", data.user.id);
                }
            }

            return NextResponse.redirect(`${origin}/`);
        }
    }

    return NextResponse.redirect(`${origin}/login`);
}
