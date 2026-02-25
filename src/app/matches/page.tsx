import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import {
    Calendar,
    MapPin,
    Users,
    PlusCircle,
    CheckCircle2,
    Clock,
    Lock,
} from "lucide-react";

export default async function MatchesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch all matches ordered by date descending
    const { data: matches } = await supabase
        .from("matches")
        .select("*, match_participants(user_id)")
        .order("date", { ascending: false });

    const statusConfig: Record<
        string,
        { label: string; icon: React.ReactNode; classes: string }
    > = {
        open: {
            label: "Open",
            icon: <Clock size={12} />,
            classes: "bg-accent/10 text-accent border-accent/30",
        },
        closed: {
            label: "Closed",
            icon: <Lock size={12} />,
            classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
        },
        finished: {
            label: "Finished",
            icon: <CheckCircle2 size={12} />,
            classes: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
        },
    };

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">All Matches</h1>
                    <p className="text-muted">Browse and join pachangas</p>
                </div>
                <Link href="/matches/new">
                    <Button size="lg">
                        <PlusCircle size={18} />
                        New Match
                    </Button>
                </Link>
            </div>

            {matches && matches.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {matches.map((match) => {
                        const playerCount = (
                            match.match_participants as { user_id: string }[]
                        ).length;
                        const isFull = playerCount >= match.max_players;
                        const hasJoined = (
                            match.match_participants as { user_id: string }[]
                        ).some((p) => p.user_id === user.id);
                        const config = statusConfig[match.status] || statusConfig.open;

                        return (
                            <Link key={match.id} href={`/matches/${match.id}`}>
                                <Card className="h-full transition-all hover:border-border-hover hover:bg-surface-hover">
                                    {/* Status + Joined Badge */}
                                    <div className="mb-3 flex items-center gap-2">
                                        <span
                                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
                                        >
                                            {config.icon}
                                            {config.label}
                                        </span>
                                        {hasJoined && (
                                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                                                Joined
                                            </span>
                                        )}
                                    </div>

                                    {/* Location */}
                                    <div className="mb-2 flex items-center gap-2 text-foreground">
                                        <MapPin size={14} className="shrink-0 text-accent" />
                                        <span className="truncate font-medium">
                                            {match.location}
                                        </span>
                                    </div>

                                    {/* Date */}
                                    <div className="mb-3 flex items-center gap-2 text-sm text-muted">
                                        <Calendar size={14} className="shrink-0" />
                                        {formatDate(match.date)}
                                    </div>

                                    {/* Players + Score */}
                                    <div className="flex items-center justify-between border-t border-border pt-3">
                                        <div className="flex items-center gap-2 text-sm text-muted">
                                            <Users size={14} />
                                            <span>
                                                {playerCount}/{match.max_players}
                                            </span>
                                        </div>

                                        {match.status === "finished" &&
                                            match.team_a_score !== null &&
                                            match.team_b_score !== null && (
                                                <span className="text-sm font-semibold text-foreground">
                                                    {match.team_a_score} – {match.team_b_score}
                                                </span>
                                            )}

                                        {match.status === "open" && (
                                            <span
                                                className={`text-xs font-medium ${isFull ? "text-red-400" : "text-accent"}`}
                                            >
                                                {isFull ? "Full" : "Join →"}
                                            </span>
                                        )}
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center">
                    <p className="mb-2 text-muted">No matches yet.</p>
                    <Link href="/matches/new">
                        <Button variant="outline" size="sm">
                            Create the first one
                        </Button>
                    </Link>
                </Card>
            )}
        </div>
    );
}
