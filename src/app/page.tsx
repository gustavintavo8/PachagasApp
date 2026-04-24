// src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, getAvatarUrl } from "@/lib/utils";
import { Calendar, Users, Zap, PlusCircle, ChevronRight } from "lucide-react";

// --- Hero Card ---

async function HeroCard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, elo_rating, matches_played, goals_scored")
    .eq("id", userId)
    .single();

  const { count: rankAbove } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("elo_rating", profile?.elo_rating ?? 1000)
    .gte("matches_played", 3);

  const rank = (rankAbove ?? 0) + 1;
  const avatarUrl = getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, profile?.avatar_url ?? null);

  return (
    <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-surface to-surface-hover/50">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/5" />
      <div className="relative z-10 flex items-center gap-4">
        <Avatar src={avatarUrl} fallback={profile?.username || "P"} size="lg" priority />
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-foreground truncate">
            {profile?.username || "Jugador"}
          </p>
          <div className="flex items-center gap-1.5 text-accent">
            <Zap size={14} />
            <span className="text-sm font-semibold">{profile?.elo_rating ?? 1000} RP</span>
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
          #{rank}
        </span>
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
        <div className="px-4 text-center first:pl-0 last:pr-0">
          <p className="text-xl font-bold text-foreground">{profile?.matches_played ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">Partidos</p>
        </div>
        <div className="px-4 text-center">
          <p className="text-xl font-bold text-foreground">{profile?.goals_scored ?? 0}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">Goles</p>
        </div>
        <div className="px-4 text-center first:pl-0 last:pr-0">
          <Link href="/leaderboard" className="block transition-opacity hover:opacity-80">
            {(profile?.matches_played ?? 0) >= 3 ? (
              <p className="text-xl font-bold text-accent">#{rank}</p>
            ) : (
              <p className="text-sm font-bold text-muted">Prov.</p>
            )}
            <p className="text-[10px] uppercase tracking-wider text-muted">Ranking</p>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function HeroCardSkeleton() {
  return <div className="h-40 rounded-xl bg-surface/50 animate-pulse" />;
}

// --- Próximo partido destacado ---

async function NextMatchCard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: openMatches } = await supabase
    .from("matches")
    .select("*, match_participants(user_id)")
    .eq("status", "open")
    .gte("date", new Date().toISOString())
    .order("date", { ascending: true })
    .maybeSingle();

  if (!openMatches) {
    return (
      <Card className="border-border/50 text-center">
        <p className="text-sm text-muted">No hay partidos abiertos ahora mismo.</p>
        <Link href="/matches/new" className="mt-2 inline-block">
          <Button variant="outline" size="sm">
            <PlusCircle size={14} />
            Crear partido
          </Button>
        </Link>
      </Card>
    );
  }

  const hasJoined = openMatches.match_participants.some((p: { user_id: string }) => p.user_id === userId);
  const playerCount = openMatches.match_participants.length;

  return (
    <Link href={`/matches/${openMatches.id}`} prefetch={false}>
      <Card className="border-accent/25 bg-gradient-to-r from-accent/8 to-transparent transition-all hover:border-accent/40 hover:shadow-[0_4px_24px_rgba(204,255,0,0.08)]">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              {hasJoined ? "✓ Apuntado" : "Próximo partido"}
            </p>
            <p className="mt-0.5 font-semibold text-foreground">{openMatches.location}</p>
          </div>
          <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted" />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate(openMatches.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} />
            {playerCount}/{openMatches.max_players}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min((playerCount / openMatches.max_players) * 100, 100)}%` }}
          />
        </div>
      </Card>
    </Link>
  );
}

function NextMatchCardSkeleton() {
  return <div className="h-28 rounded-xl bg-surface/50 animate-pulse" />;
}

// --- Lista de partidos abiertos ---

async function MoreOpenMatches({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*, match_participants(user_id)")
    .eq("status", "open")
    .gte("date", new Date().toISOString())
    .order("date", { ascending: true })
    .range(1, 5); // skip the first (shown in NextMatchCard)

  if (!matches || matches.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Más partidos</p>
        <Link href="/matches" className="text-xs font-medium text-accent hover:underline">
          Ver todos →
        </Link>
      </div>
      {matches.map((match) => {
        const hasJoined = match.match_participants.some((p: { user_id: string }) => p.user_id === userId);
        return (
          <Link key={match.id} href={`/matches/${match.id}`} prefetch={false}>
            <Card className="flex items-center gap-3 border-border/60 py-3 transition-colors hover:border-accent/30">
              <div className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{match.location}</p>
                <p className="text-xs text-muted">{formatDate(match.date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasJoined && (
                  <span className="text-[10px] font-bold text-accent">✓</span>
                )}
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                  {match.match_participants.length}/{match.max_players}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function MoreOpenMatchesSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-24 rounded bg-surface/50 animate-pulse" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={`skeleton-more-${i}`} className="h-16 rounded-xl bg-surface/50 animate-pulse" />
      ))}
    </div>
  );
}

// --- Main Page ---

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Suspense fallback={<HeroCardSkeleton />}>
        <HeroCard userId={user.id} />
      </Suspense>

      <Suspense fallback={<NextMatchCardSkeleton />}>
        <NextMatchCard userId={user.id} />
      </Suspense>

      <Suspense fallback={<MoreOpenMatchesSkeleton />}>
        <MoreOpenMatches userId={user.id} />
      </Suspense>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <HeroCardSkeleton />
        <NextMatchCardSkeleton />
        <MoreOpenMatchesSkeleton />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
