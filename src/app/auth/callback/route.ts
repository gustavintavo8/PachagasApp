import { hasCommunityAccess } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const protocol = request.headers.get("x-forwarded-proto") || url.protocol;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
    const origin = `${protocol}://${host}`;
    const code = searchParams.get("code");
    const response = NextResponse.redirect(`${origin}/login`);

    if (code) {
        // Bind Supabase's cookie writes to the exact response that leaves this
        // route. Using the generic server helper here can update Next's cookie
        // store without carrying those Set-Cookie headers onto this redirect.
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            // Never log the one-time OAuth code or any session material.
            console.error("[auth/callback] OAuth code exchange failed", {
                name: error.name,
                code: error.code,
            });
        }

        // supabase-js >= 2.91.0 defers the SIGNED_IN notification that the SSR
        // adapter uses to persist auth cookies. Let that notification run
        // before returning the redirect, otherwise Vercel can redirect to a
        // protected page without a session and send the user back to /login.
        if (!error) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

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

            const targetPath = await hasCommunityAccess(data.user.id) ? "/" : "/access";
            response.headers.set("Location", `${origin}${targetPath}`);
        }
    }

    return response;
}
