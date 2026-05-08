import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { MatchDetail } from "./MatchDetail";
import { isAdmin, getAdminUserIds } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: match } = await admin
        .from("matches")
        .select("location, date, max_players, status")
        .eq("id", id)
        .single();

    if (!match) {
        return { title: "Partido — Pachanga" };
    }

    const formattedDate = new Date(match.date).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

    const title = `Partido en ${match.location} — Pachanga`;
    const description = `${formattedDate} · Hasta ${match.max_players} jugadores`;

    return {
        title,
        description,
        alternates: { canonical: `${BASE_URL}/matches/${id}` },
        openGraph: {
            title,
            description,
            type: "website",
            url: `${BASE_URL}/matches/${id}`,
        },
    };
}

export default async function MatchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const isGuest = user.is_anonymous === true;

    const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .single();

    if (!match) notFound();

    const [{ data: participants }, { data: organizerProfile }, { data: currentProfile }, adminUserIds, userIsAdmin] =
        await Promise.all([
            supabase.from("match_participants").select("*, profiles(*)").eq("match_id", id),
            supabase.from("profiles").select("username, avatar_url").eq("id", match.created_by).single(),
            supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single(),
            getAdminUserIds(),
            isAdmin(user.id),
        ]);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SportsEvent",
                        name: `Partido de fútbol en ${match.location}`,
                        startDate: match.date,
                        location: {
                            "@type": "Place",
                            name: match.location,
                        },
                        sport: "Fútbol",
                        url: `${BASE_URL}/matches/${id}`,
                    }),
                }}
            />
            <MatchDetail
                match={match}
                participants={participants || []}
                currentUserId={user.id}
                organizerName={organizerProfile?.username || "Desconocido"}
                organizerAvatarUrl={organizerProfile?.avatar_url || null}
                currentUserProfile={{
                    username: currentProfile?.username ?? null,
                    avatar_url: currentProfile?.avatar_url ?? null,
                }}
                isAdmin={userIsAdmin}
                adminUserIds={adminUserIds}
                isGuest={isGuest}
            />
        </>
    );
}
