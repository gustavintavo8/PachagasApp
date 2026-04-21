import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Trophy, Wallet } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

function formatBudget(n: number) {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n);
}

export default async function ClasificacionPage() {
    const supabase = await createClient();

    const [{ data: { user } }, { data: teams }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
            .from("fantasy_teams")
            .select("*, profiles(username, avatar_url)")
            .order("total_points", { ascending: false }),
    ]);

    if (!teams || teams.length === 0) {
        return (
            <p className="py-12 text-center text-sm text-muted">
                Aún no hay equipos en la clasificación
            </p>
        );
    }

    const teamIds = teams.map((t) => t.id);
    const { data: rosterCounts } = await supabase
        .from("fantasy_rosters")
        .select("team_id")
        .in("team_id", teamIds);

    const countMap: Record<string, number> = {};
    for (const row of rosterCounts ?? []) {
        countMap[row.team_id] = (countMap[row.team_id] ?? 0) + 1;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return (
        <div className="space-y-2">
            {teams.map((team, idx) => {
                const profile = team.profiles as { username: string | null; avatar_url: string | null } | null;
                const avatarUrl = getAvatarUrl(supabaseUrl, profile?.avatar_url ?? null);
                const playerCount = countMap[team.id] ?? 0;
                const isMe = user && team.user_id === user.id;

                return (
                    <Card
                        key={team.id}
                        className={`flex items-center gap-4 p-4 ${isMe ? "border-accent/50 ring-1 ring-accent/20" : ""}`}
                    >
                        <span className="w-8 shrink-0 text-center text-lg font-bold">
                            {MEDALS[idx] ?? `#${idx + 1}`}
                        </span>

                        <Avatar
                            src={avatarUrl}
                            fallback={profile?.username || "?"}
                            size="sm"
                        />

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="truncate font-semibold text-foreground">{team.name}</p>
                                {isMe && (
                                    <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                                        Tú
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted">
                                {profile?.username ?? "Desconocido"} · {playerCount}/11 jugadores
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 font-bold text-accent">
                                <Trophy size={14} />
                                <span>{team.total_points} pts</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted">
                                <Wallet size={11} />
                                <span>{formatBudget(team.budget)}</span>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
