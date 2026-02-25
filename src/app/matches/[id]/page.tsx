import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { MatchDetail } from "./MatchDetail";

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

    const { data: participants } = await supabase
        .from("match_participants")
        .select("*, profiles(*)")
        .eq("match_id", id);

    const { data: organizerProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", match.created_by)
        .single();

    return (
        <MatchDetail
            match={match}
            participants={participants || []}
            currentUserId={user.id}
            organizerName={organizerProfile?.username || "Unknown"}
        />
    );
}
