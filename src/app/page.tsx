import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getTimeUntil, getAvatarUrl } from "@/lib/utils";
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  Target,
  PlusCircle,
  Clock,
  Zap,
} from "lucide-react";
import { PlayerCharts } from "@/components/PlayerCharts";

// --- Async Data Components ---

async function DashboardStats({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute right-4 top-4 text-accent/20">
          <Trophy size={48} />
        </div>
        <p className="text-sm text-muted">Partidos Jugados</p>
        <p className="mt-1 text-3xl font-bold text-foreground">
          <span className="text-accent">{profile?.matches_played ?? 0}</span>
        </p>
      </Card>
      <Card className="relative overflow-hidden">
        <div className="absolute right-4 top-4 text-accent/20">
          <Target size={48} />
        </div>
        <p className="text-sm text-muted">Goles Marcados</p>
        <p className="mt-1 text-3xl font-bold text-foreground">
          <span className="text-accent">{profile?.goals_scored ?? 0}</span>
        </p>
      </Card>
    </>
  );
}

async function NextMatchHighlight({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: userParticipations } = await supabase
    .from("match_participants")
    .select("match_id, matches(*)")
    .eq("user_id", userId);

  const nextMatch = userParticipations
    ?.map((p) => p.matches as any)
    .filter((m) => m && new Date(m.date) > new Date() && m.status !== "finished")
    .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime())[0];

  return (
    <>
      {/* 3rd Stats Card is technically Next Match countdown */}
      <Card className="relative overflow-hidden">
        <div className="absolute right-4 top-4 text-accent/20">
          <Clock size={48} />
        </div>
        <p className="text-sm text-muted">Próximo Partido</p>
        {nextMatch ? (
          <p className="mt-1 text-3xl font-bold text-accent">
            {getTimeUntil(nextMatch.date)}
          </p>
        ) : (
          <p className="mt-1 text-lg text-muted">Ninguno aún</p>
        )}
      </Card>

      {/* Hero Highlight Box */}
      {nextMatch && (
        <div className="mt-8 col-span-full">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <Zap size={20} className="inline text-accent" /> Tu Próximo Partido
          </h2>
          <Link href={`/matches/${nextMatch.id}`} prefetch={false}>
            <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-transparent transition-colors hover:border-accent/50 hover:bg-accent/10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-accent">
                    <Calendar size={16} />
                    <span className="font-medium">
                      {formatDate(nextMatch.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <MapPin size={16} />
                    <span>{nextMatch.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-accent">
                    {getTimeUntil(nextMatch.date)}
                  </p>
                  <p className="text-xs text-muted">para el pitido inicial</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}
    </>
  );
}

async function OpenMatchesList({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: openMatches } = await supabase
    .from("matches")
    .select("*, match_participants(user_id)")
    .eq("status", "open")
    .gte("date", new Date().toISOString())
    .order("date", { ascending: true });

  if (!openMatches || openMatches.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-muted">No hay partidos abiertos ahora mismo.</p>
        <Link href="/matches/new" className="mt-2 inline-block">
          <Button variant="outline" size="sm">Crea uno</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {openMatches.map((match) => {
        const playerCount = match.match_participants.length;
        const isFull = playerCount >= match.max_players;
        const hasJoined = match.match_participants.some((p: any) => p.user_id === userId);

        return (
          <Link key={match.id} href={`/matches/${match.id}`} prefetch={false} className="group block h-full">
            <Card className="h-full transition-all border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(204,255,0,0.08)]">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Calendar size={14} />
                    {formatDate(match.date)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-foreground">
                    <MapPin size={14} />
                    <span className="font-medium">{match.location}</span>
                  </div>
                </div>
                {hasJoined && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    Apuntado
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 bg-black/10 px-6 py-3 -mx-6 -mb-6 rounded-b-2xl">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10">
                    <Users size={12} className="text-accent" />
                  </div>
                  <span>
                    {playerCount}<span className="text-muted/70 font-normal text-xs uppercase tracking-wider ml-1">/ {match.max_players}</span>
                  </span>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isFull ? "text-red-400" : "text-accent group-hover:scale-105 transition-transform"}`}>
                  {isFull ? "Completo" : "Abierto →"}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

// --- Loading Skeletons ---
function StatsSkeleton() {
  return (
    <>
      <div className="h-28 rounded-xl bg-surface/50 animate-pulse" />
      <div className="h-28 rounded-xl bg-surface/50 animate-pulse" />
    </>
  );
}

function NextMatchSkeleton() {
  return <div className="h-28 rounded-xl bg-surface/50 animate-pulse" />;
}

function MatchesListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`match-list-skeleton-${i}`} className="h-32 rounded-xl bg-surface/50 animate-pulse" />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-surface/50 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-surface/50 animate-pulse" />
            <div className="h-4 w-32 rounded bg-surface/50 animate-pulse" />
          </div>
        </div>
        <div className="h-10 w-36 rounded-xl bg-surface/50 animate-pulse" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <StatsSkeleton />
        <NextMatchSkeleton />
      </div>
      <div className="mt-8">
        <div className="mb-4 h-6 w-48 rounded bg-surface/50 animate-pulse" />
        <MatchesListSkeleton />
      </div>
    </div>
  );
}


function DetailedStatsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="h-64 rounded-xl bg-surface/50 animate-pulse" />
        <div className="h-64 rounded-xl bg-surface/50 animate-pulse" />
      </div>
      <div>
        <div className="h-24 rounded-xl bg-surface/50 animate-pulse mb-3" />
        <div className="h-24 rounded-xl bg-surface/50 animate-pulse mb-3" />
        <div className="h-24 rounded-xl bg-surface/50 animate-pulse" />
      </div>
    </div>
  );
}

async function DetailedDashboardStats({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: participations } = await supabase
    .from("match_participants")
    .select("match_id, team, goals, is_mvp, matches(id, date, location, status, team_a_score, team_b_score)")
    .eq("user_id", userId);

  const finishedMatches = participations
    ?.map((p) => {
        const match = p.matches as unknown as {
            id: string;
            date: string;
            location: string;
            status: string;
            team_a_score: number | null;
            team_b_score: number | null;
        };
        return {
            ...match,
            userTeam: p.team,
            userGoals: p.goals,
            userMvp: p.is_mvp,
        };
    })
    .filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    ?? [];

  // Charts Logic
  const monthMap: Record<string, number> = {};
  const chronological = [...finishedMatches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (const m of chronological) {
      const d = new Date(m.date);
      const key = `${d.toLocaleString("es-ES", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
      monthMap[key] = (monthMap[key] || 0) + (m.userGoals || 0);
  }
  const goalsPerMonth = Object.entries(monthMap).map(([month, goals]) => ({ month, goals }));

  let w = 0;
  const winRateOverTime = chronological
      .filter((m) => m.team_a_score !== null && m.team_b_score !== null && m.userTeam)
      .map((m, i) => {
          const my = m.userTeam === "A" ? m.team_a_score! : m.team_b_score!;
          const opp = m.userTeam === "A" ? m.team_b_score! : m.team_a_score!;
          if (my > opp) w++;
          return { match: i + 1, rate: Math.round((w / (i + 1)) * 100) };
      });

  // RP History
  const { data: rpHistoryData } = await supabase
      .from("rp_history")
      .select("new_rp, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

  let matchCounter = 1;
  const rpOverTime = rpHistoryData?.map((entry) => ({
      match: matchCounter++,
      rp: entry.new_rp,
  })) || [];

  return (
    <div className="space-y-12">
        {/* Charts */}
        <div>
            <PlayerCharts goalsPerMonth={goalsPerMonth} winRateOverTime={winRateOverTime} rpOverTime={rpOverTime} />
        </div>

        {/* Recent Matches */}
        <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
                Partidos Recientes
            </h2>
            {finishedMatches.length > 0 ? (
                <div className="space-y-3">
                    {finishedMatches.slice(0, 5).map((match) => {
                        const myScore = match.userTeam === "A" ? match.team_a_score : match.team_b_score;
                        const oppScore = match.userTeam === "A" ? match.team_b_score : match.team_a_score;
                        let result: "win" | "draw" | "loss" | null = null;
                        if (myScore !== null && oppScore !== null && match.userTeam) {
                            if (myScore > oppScore) result = "win";
                            else if (myScore === oppScore) result = "draw";
                            else result = "loss";
                        }

                        const resultConfig = {
                            win: { label: "VICTORIA", bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
                            draw: { label: "EMPATE", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30" },
                            loss: { label: "DERROTA", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
                        };

                        const config = result ? resultConfig[result] : null;

                        return (
                            <Link key={match.id} href={`/matches/${match.id}`} className="group block">
                                <Card className="transition-all border border-border/80 bg-gradient-to-br from-surface to-surface-hover/30 hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(204,255,0,0.08)]">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                {config && (
                                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${config.bg} ${config.text} ${config.border}`}>
                                                        {config.label}
                                                    </span>
                                                )}
                                                {match.userMvp && (
                                                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-500/90 border border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                                                        MVP
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-foreground">
                                                <MapPin size={14} className="shrink-0 text-accent" />
                                                <span className="truncate font-medium">{match.location}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={14} />
                                                    {formatDate(match.date)}
                                                </span>
                                                {match.userGoals > 0 && (
                                                    <span className="flex items-center gap-1 text-accent font-semibold">
                                                        <Target size={14} />
                                                        {match.userGoals} gol{match.userGoals !== 1 ? "es" : ""}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {match.team_a_score !== null && match.team_b_score !== null && (
                                        <div className="mt-4 flex items-center justify-between border-t border-border/50 bg-black/10 px-6 py-3 -mx-6 -mb-6 rounded-b-2xl">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted group-hover:text-foreground transition-colors relative z-10 pointer-events-none">Ver Detalles →</span>
                                            <div className="flex items-center justify-end gap-3 text-center shrink-0 min-w-[70px]">
                                                <div>
                                                    <p className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 text-red-400 flex items-center`}>
                                                        Rojo {match.userTeam === "A" && <span className="text-accent ml-1">(P)</span>}
                                                    </p>
                                                    <p className={`text-xl font-bold leading-none ${match.userTeam === "A" && result === "win" ? "text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)] scale-110" : "text-foreground"}`}>
                                                        {match.team_a_score}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-bold text-muted/50">-</span>
                                                <div className="flex flex-col items-end">
                                                    <p className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 text-blue-400 flex items-center`}>
                                                        {match.userTeam === "B" && <span className="text-accent mr-1">(P)</span>} Azul
                                                    </p>
                                                    <p className={`text-xl font-bold leading-none ${match.userTeam === "B" && result === "win" ? "text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)] scale-110" : "text-foreground"}`}>
                                                        {match.team_b_score}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center">
                    <p className="py-4 text-muted">Aún sin partidos finalizados</p>
                </Card>
            )}
        </div>
    </div>
  );
}

// --- Main Page Shell ---
async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only block TTFB for the absolute minimum: basic profile name/avatar
  const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single();

  const avatarUrl = getAvatarUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    profile?.avatar_url ?? null
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            src={avatarUrl}
            fallback={profile?.username || user.email || "P"}
            size="lg"
            priority={true}
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Hola, {profile?.username || "Jugador"}
            </h1>
            <p className="text-muted">¿Listo para la próxima pachanga?</p>
          </div>
        </div>
        <Link href="/matches/new">
          <Button size="lg">
            <PlusCircle size={18} />
            Nuevo Partido
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardStats userId={user.id} />
        </Suspense>

        <Suspense fallback={<NextMatchSkeleton />}>
          <NextMatchHighlight userId={user.id} />
        </Suspense>
      </div>

      {/* Open Matches */}
      <div className="mt-8 mb-12">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          <Trophy size={20} className="inline text-accent" /> Partidos Abiertos
        </h2>
        <Suspense fallback={<MatchesListSkeleton />}>
          <OpenMatchesList userId={user.id} />
        </Suspense>
      </div>

      {/* Detailed Season Stats */}
      <div className="mt-8 mb-12">
        <Suspense fallback={<DetailedStatsSkeleton />}>
          <DetailedDashboardStats userId={user.id} />
        </Suspense>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
