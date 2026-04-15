import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { MatchDetail } from "./MatchDetail";
import { isAdmin, getAdminUserIds } from "@/lib/permissions";

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
        />
    );
}
