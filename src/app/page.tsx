// src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cache, Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Fila, Filas } from "@/components/Filas";
import { Panenka } from "@/components/Panenka";
import { getAvatarUrl } from "@/lib/utils";
import { getActiveSeason } from "@/lib/seasons";
import { requireCommunityAccess } from "@/lib/access";
import { isAdmin } from "@/lib/permissions";
import { ELO_BASE, PROVISIONAL_THRESHOLD } from "@/lib/elo";
import {
  elegirPartidoPortada,
  fechaCorta,
  lineaPuesto,
  participanteCronica,
  plural,
  preguntaPortada,
  titularCronica,
} from "@/lib/titulares";
import type { MatchParticipant, MatchStatus, Profile } from "@/lib/types";
import { InicioPortada, PortadaSinDatos, type PartidoInicio } from "./InicioPortada";
import Loading from "./loading";

const MAX_OTROS_PARTIDOS = 5;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

type FilaPlaza = Pick<MatchParticipant, "user_id" | "team"> & {
  profiles: Pick<Profile, "username"> | null;
};

type FilaPartido = Pick<PartidoInicio, "id" | "date" | "location" | "max_players"> & {
  status: MatchStatus;
  created_by: string;
  match_participants: FilaPlaza[];
};

type FilaTemporada = {
  user_id: string;
  elo_rating: number | null;
  matches_played: number | null;
  goals_scored: number | null;
  profiles: Pick<Profile, "username" | "avatar_url"> | null;
};

function aPartidoInicio(fila: FilaPartido): PartidoInicio & { created_by: string } {
  return {
    id: fila.id,
    date: fila.date,
    location: fila.location,
    max_players: fila.max_players,
    status: fila.status,
    created_by: fila.created_by,
    participants: fila.match_participants.map((plaza) => ({
      user_id: plaza.user_id,
      team: plaza.team,
      nombre: plaza.profiles?.username ?? null,
    })),
  };
}

// --- Lecturas, compartidas entre los tres bloques con cache() ---

/** Abiertos y cerrados desde ayer: elegirPartidoPortada decide qué sigue vigente en hora de Madrid. */
const leerPartidos = cache(async (seasonId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, date, location, max_players, status, created_by, match_participants(user_id, team, profiles(username))")
    .in("status", ["open", "closed"])
    .eq("season_id", seasonId)
    .gte("date", new Date(Date.now() - UN_DIA_MS).toISOString())
    .order("date", { ascending: true })
    .limit(20);
  return { partidos: ((data ?? []) as unknown as FilaPartido[]).map(aPartidoInicio), error };
});

/** En el mismo orden que el ranking, para que el puesto de aquí sea el de allí. */
const leerTemporada = cache(async (seasonId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("season_player_stats")
    .select("user_id, elo_rating, matches_played, goals_scored, profiles!inner(username, avatar_url)")
    .eq("season_id", seasonId)
    .order("elo_rating", { ascending: false })
    .order("matches_played", { ascending: false });
  return (data ?? []) as unknown as FilaTemporada[];
});

async function leerUltimoResultado(seasonId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("id, team_a_score, team_b_score, match_participants(team, goals, profiles(username, position))")
    .eq("status", "finished")
    .eq("season_id", seasonId)
    .not("team_a_score", "is", null)
    .not("team_b_score", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as unknown as {
    id: string;
    team_a_score: number;
    team_b_score: number;
    match_participants: Parameters<typeof participanteCronica>[0][];
  } | null;
}

// --- Tu sitio, sin hacer ruido ---

async function TuPuesto({ userId, seasonId }: { userId: string; seasonId: string }) {
  const temporada = await leerTemporada(seasonId);
  const mia = temporada.find((fila) => fila.user_id === userId);
  const cuentan = temporada.filter((fila) => (fila.matches_played ?? 0) >= PROVISIONAL_THRESHOLD);
  const indice = cuentan.findIndex((fila) => fila.user_id === userId);

  return (
    <Link
      href="/leaderboard"
      className="pulsable t-meta flex min-h-11 flex-none items-center whitespace-nowrap text-muted tabular-nums"
    >
      {lineaPuesto({ posicion: indice === -1 ? null : indice + 1, rp: mia?.elo_rating ?? ELO_BASE })}
    </Link>
  );
}

// --- El último resultado: más pequeño que «Faltan 3», siempre ---

function BandaResultado({ ultimo }: { ultimo: NonNullable<Awaited<ReturnType<typeof leerUltimoResultado>>> }) {
  const { team_a_score: rojo, team_b_score: azul } = ultimo;
  const { frasePanenka } = titularCronica({
    id: ultimo.id,
    rojo,
    azul,
    participantes: ultimo.match_participants.map(participanteCronica),
  });
  const total = rojo + azul;
  const costura = total === 0 ? 50 : Math.min(72, Math.max(28, (rojo / total) * 100));

  return (
    <Link
      href={`/matches/${ultimo.id}`}
      prefetch={false}
      aria-label={`Último resultado: Rojo ${rojo}, Azul ${azul}. ${frasePanenka}`}
      className="relative mt-6 block select-none"
    >
      <div className="grid h-14 text-white" style={{ gridTemplateColumns: `${costura}% 1fr` }}>
        <div className="flex items-center justify-end bg-rojo pr-3.5">
          <span className="t-cifra text-[42px]">{rojo}</span>
        </div>
        <div className="flex items-center border-l-2 border-white bg-azul pl-3.5">
          <span className="t-cifra text-[42px]">{azul}</span>
        </div>
      </div>
      <Panenka size={84} className="absolute right-3 top-0" />
      <p className="min-h-[60px] py-2.5 pl-4 pr-[108px] text-[15px] font-medium leading-snug">{frasePanenka}</p>
    </Link>
  );
}

// --- Portada ---

async function Portada({ userId, seasonId }: { userId: string; seasonId: string }) {
  const ahora = new Date().toISOString();
  const [{ partidos, error }, temporada, admin, ultimo] = await Promise.all([
    leerPartidos(seasonId),
    leerTemporada(seasonId),
    isAdmin(userId),
    leerUltimoResultado(seasonId),
  ]);

  if (error) return <PortadaSinDatos pregunta={preguntaPortada(null, ahora)} />;

  const { partido } = elegirPartidoPortada(partidos, userId, ahora);
  const organizo = partido?.created_by === userId;

  const candidatos = temporada.flatMap((fila) =>
    (fila.matches_played ?? 0) > 0 && fila.profiles?.username
      ? [{ id: fila.user_id, nombre: fila.profiles.username, partidos: fila.matches_played ?? 0 }]
      : []
  ).sort((a, b) => b.partidos - a.partidos);

  return (
    <InicioPortada
      partido={partido}
      yo={userId}
      miNombre={temporada.find((fila) => fila.user_id === userId)?.profiles?.username ?? null}
      ahora={ahora}
      puedeBorrarse={partido?.status === "open" && !organizo && !admin}
      candidatos={candidatos}
      puesto={
        <Suspense fallback={<div className="skeleton h-5 w-32 flex-none" />}>
          <TuPuesto userId={userId} seasonId={seasonId} />
        </Suspense>
      }
      banda={ultimo && <BandaResultado ultimo={ultimo} />}
    />
  );
}

// --- Bajo el pliegue ---

async function OtrosPartidos({ userId, seasonId }: { userId: string; seasonId: string }) {
  const { partidos } = await leerPartidos(seasonId);
  const { otros } = elegirPartidoPortada(partidos, userId, new Date().toISOString());
  if (otros.length === 0) return null;

  return (
    <section className="pt-8">
      <div className="flex items-center justify-between gap-3 px-4 pb-1">
        <h2 className="t-seccion">Más partidos</h2>
        <Link href="/matches" className="pulsable t-meta flex min-h-11 items-center pl-3 text-muted">
          Ver todos
        </Link>
      </div>
      <Filas aria-label="Más partidos">
        {otros.slice(0, MAX_OTROS_PARTIDOS).map((otro) => {
          const apuntado = otro.participants.some((plaza) => plaza.user_id === userId);
          return (
            <li key={otro.id} className="border-b border-border">
              {/* Fila no deja pasar prefetch, y estos enlaces siguen sin precargar */}
              <Link
                href={`/matches/${otro.id}`}
                prefetch={false}
                className="flex min-h-14 select-none items-center gap-3 px-4 py-2 active:bg-surface"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{fechaCorta(otro.date)}</span>
                  <span className="t-meta block truncate text-muted">
                    {apuntado ? `Apuntado, ${otro.location}` : otro.location}
                  </span>
                </span>
                <span
                  className="t-cifra flex-none text-[26px]"
                  aria-label={`${otro.participants.length} de ${otro.max_players} plazas`}
                >
                  {otro.participants.length}/{otro.max_players}
                </span>
              </Link>
            </li>
          );
        })}
      </Filas>
    </section>
  );
}

async function TuTemporada({ userId, seasonId }: { userId: string; seasonId: string }) {
  const temporada = await leerTemporada(seasonId);
  const { partidos } = await leerPartidos(seasonId);
  const { partido } = elegirPartidoPortada(partidos, userId, new Date().toISOString());
  const mia = temporada.find((fila) => fila.user_id === userId);
  const nombre = mia?.profiles?.username || "Jugador";
  const avatarUrl = getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, mia?.profiles?.avatar_url ?? null);

  return (
    <section className="pb-8 pt-8">
      <Filas aria-label="Tu temporada">
        <Fila
          href={`/players/${userId}`}
          inicio={<Avatar src={avatarUrl} fallback={nombre} size="md" />}
          nombre={nombre}
          detalle={`${plural(mia?.matches_played ?? 0, "partido")}, ${plural(mia?.goals_scored ?? 0, "gol")}`}
        />
        {/* En «No hay pachanga» esta acción ya es el botón principal, y solo puede haber una */}
        {partido && <Fila href="/matches/new" nombre="Montar partido" />}
      </Filas>
    </section>
  );
}

// --- Main Page ---

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const access = await requireCommunityAccess(user);
  if (!access.success) redirect("/access");

  const season = await getActiveSeason();

  return (
    <>
      <Suspense fallback={<Loading />}>
        <Portada userId={user.id} seasonId={season.id} />
      </Suspense>

      <Suspense fallback={null}>
        <OtrosPartidos userId={user.id} seasonId={season.id} />
      </Suspense>

      <Suspense fallback={null}>
        <TuTemporada userId={user.id} seasonId={season.id} />
      </Suspense>
    </>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardContent />
    </Suspense>
  );
}
