import { createClient } from "@/lib/supabase/server";
import type { FantasyTeam } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Trophy } from "lucide-react";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function ClasificacionPage() {
    const supabase = await createClient();
    const { data: teams } = await supabase
        .from("fantasy_teams")
        .select("*")
        .order("total_points", { ascending: false });

    const list = (teams ?? []) as FantasyTeam[];

    return (
        <div className="space-y-2">
            {list.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">
                    Aún no hay equipos en la clasificación
                </p>
            ) : (
                list.map((team, idx) => (
                    <Card key={team.id} className="flex items-center gap-4 p-4">
                        <span className="w-8 text-center text-lg font-bold">
                            {MEDALS[idx] ?? `#${idx + 1}`}
                        </span>
                        <p className="min-w-0 flex-1 truncate font-semibold text-foreground">
                            {team.name}
                        </p>
                        <div className="flex items-center gap-1.5 font-bold text-accent">
                            <Trophy size={16} />
                            <span>{team.total_points} pts</span>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}
