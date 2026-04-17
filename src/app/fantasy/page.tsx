import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/utils";
import type { FantasyRoster, Profile } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { CreateTeamForm } from "./CreateTeamForm";
import { CaptainSelector } from "./CaptainSelector";
import { Wallet } from "lucide-react";

type RosterWithProfile = FantasyRoster & { profiles: Profile };

function formatBudget(n: number) {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n);
}

export default async function FantasyPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: team } = await supabase
        .from("fantasy_teams")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

    if (!team) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-16">
                <div className="text-center">
                    <p className="mb-2 text-xl font-semibold text-foreground">
                        ¡Aún no tienes equipo!
                    </p>
                    <p className="text-sm text-muted">
                        Crea tu equipo fantasy y empieza a competir.
                    </p>
                </div>
                <CreateTeamForm />
            </div>
        );
    }

    const { data: rosterData } = await supabase
        .from("fantasy_rosters")
        .select("*, profiles(*)")
        .eq("team_id", team.id);

    const roster = (rosterData ?? []) as RosterWithProfile[];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return (
        <div className="space-y-6">
            {/* Team header */}
            <Card>
                <CardHeader>
                    <CardTitle>{team.name}</CardTitle>
                    <div className="flex items-center gap-2 font-semibold text-accent">
                        <Wallet size={18} />
                        <span>{formatBudget(team.budget)}</span>
                    </div>
                </CardHeader>
                <div className="flex items-center gap-4 text-sm text-muted">
                    <span>{roster.length} jugadores</span>
                    <span className="font-semibold text-foreground">{team.total_points} pts</span>
                </div>
            </Card>

            {/* Captain selector */}
            {roster.length > 0 && <CaptainSelector teamId={team.id} roster={roster} />}

            {/* Roster grid */}
            <div>
                <h2 className="mb-3 text-base font-semibold text-foreground">Plantilla</h2>
                {roster.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted">
                        Tu plantilla está vacía. ¡Ve al Mercado para fichar jugadores!
                    </p>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {roster.map((entry) => {
                            const avatarUrl = getAvatarUrl(supabaseUrl, entry.profiles.avatar_url);
                            return (
                                <Card key={entry.player_id} className="flex items-center gap-3 p-4">
                                    <Avatar
                                        src={avatarUrl}
                                        fallback={entry.profiles.username || "?"}
                                        size="sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-foreground">
                                            {entry.profiles.username ?? "Sin nombre"}
                                        </p>
                                        <p className="text-xs text-muted">
                                            {entry.profiles.position ?? "—"} ·{" "}
                                            {entry.profiles.elo_rating} RP
                                        </p>
                                    </div>
                                    {entry.is_captain && (
                                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                                            CAP
                                        </span>
                                    )}
                                    <p className="text-sm font-semibold text-foreground">
                                        {entry.profiles.market_value
                                            ? formatBudget(entry.profiles.market_value)
                                            : "—"}
                                    </p>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
