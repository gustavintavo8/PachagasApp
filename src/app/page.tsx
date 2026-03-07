import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
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
} from "lucide-react";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile, open matches, and user participations in parallel
  const [{ data: profile }, { data: openMatches }, { data: userParticipations }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("matches")
        .select("*, match_participants(user_id)")
        .eq("status", "open")
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true }),
      supabase
        .from("match_participants")
        .select("match_id, matches(*)")
        .eq("user_id", user.id),
    ]);

  const nextMatch = userParticipations
    ?.map((p) => p.matches as unknown as (typeof openMatches extends (infer T)[] | null ? T : never))
    .filter((m) => m && new Date(m.date) > new Date() && m.status !== "finished")
    .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime())[0];

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
              Hola, {profile?.username || "Jugador"} 👋
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

      <div className="grid gap-6 md:grid-cols-3">
        {/* Stats Cards */}
        <Card className="relative overflow-hidden">
          <div className="absolute right-4 top-4 text-accent/20">
            <Trophy size={48} />
          </div>
          <p className="text-sm text-muted">Partidos Jugados</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {profile?.matches_played ?? 0}
          </p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-4 top-4 text-accent/20">
            <Target size={48} />
          </div>
          <p className="text-sm text-muted">Goles Marcados</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {profile?.goals_scored ?? 0}
          </p>
        </Card>

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
      </div>

      {/* Next Match Highlight */}
      {nextMatch && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            ⚡ Tu Próximo Partido
          </h2>
          <Link href={`/matches/${nextMatch.id}`}>
            <Card className="border-accent/30 bg-accent/5 transition-colors hover:bg-accent/10">
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

      {/* Open Matches */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          🏟️ Partidos Abiertos
        </h2>
        {openMatches && openMatches.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {openMatches.map((match) => {
              const playerCount = (
                match.match_participants as { user_id: string }[]
              ).length;
              const isFull = playerCount >= match.max_players;
              const hasJoined = (
                match.match_participants as { user_id: string }[]
              ).some((p) => p.user_id === user.id);

              return (
                <Link key={match.id} href={`/matches/${match.id}`}>
                  <Card className="h-full transition-all hover:border-border-hover hover:bg-surface-hover">
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Users size={14} />
                        <span>
                          {playerCount}/{match.max_players} jugadores
                        </span>
                      </div>
                      {isFull ? (
                        <span className="text-xs font-medium text-red-400">
                          Completo
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-accent">
                          Abierto
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
            <p className="text-muted">No hay partidos abiertos ahora mismo.</p>
            <Link href="/matches/new" className="mt-2 inline-block">
              <Button variant="outline" size="sm">
                Crea uno
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
