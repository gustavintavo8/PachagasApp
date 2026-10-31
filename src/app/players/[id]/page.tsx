import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { Fila, Filas } from "@/components/Filas";
import { Flood } from "@/components/Flood";
import { PanenkaDice } from "@/components/PanenkaDice";
import { Peto } from "@/components/Peto";
import { GolesPorMes, GraficoRP, type GolesMes, type PuntoRP } from "@/components/PlayerCharts";
import { Avatar } from "@/components/ui/Avatar";
import { getTemporada } from "@/app/leaderboard/datos";
import { clasificados, ordenar } from "@/app/leaderboard/tabla";
import { PROVISIONAL_THRESHOLD } from "@/lib/elo";
import { POSITION_FULL } from "@/lib/positions";
import { getActiveSeason } from "@/lib/seasons";
import { createClient } from "@/lib/supabase/server";
import {
    calcularRacha,
    conSigno,
    diaYMes,
    diasHasta,
    elegirPlural,
    equipoDeTeam,
    frasePanenkaJugador,
    fraseVacio,
    lineasCartel,
    mesMadrid,
    ordinalCorto,
    plural,
    resultadoDe,
    titularJugador,
    titularPetoJugador,
    type DatosJugador,
} from "@/lib/titulares";
import type { MatchParticipant } from "@/lib/types";
import { cn, getAvatarUrl } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pachanga.app";

const NOMBRE_RESULTADO = { V: "Victoria", E: "Empate", D: "Derrota" } as const;

// Lo que va bajo el campo de color vuelve a los valores de suelo: el Flood los cambia en <main>
const SUELO =
    "[--border-hover:#4a4a4a] [--border:#2a2a2a] [--foreground:#f4f4f4] [--muted:#a8a8a8] [--surface-hover:#1f1f1f] [--surface:#141414]";

type PartidoFicha = {
    id: string;
    date: string;
    location: string;
    status: string;
    team_a_score: number | null;
    team_b_score: number | null;
};

/** Dentro de un <script> un nombre puede cerrar la etiqueta: «<» nunca sale tal cual. */
function jsonLd(datos: unknown): string {
    return JSON.stringify(datos).replace(/</g, "\\u003c");
}

function posicionDe(position: string | null | undefined): string {
    return (position && POSITION_FULL[position]) || "Jugador";
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createClient();

    const season = await getActiveSeason();
    const [{ data: profile }, { data: seasonStats }] = await Promise.all([
        supabase.from("profiles").select("username, position").eq("id", id).single(),
        supabase
            .from("season_player_stats")
            .select("elo_rating, matches_played")
            .eq("season_id", season.id)
            .eq("user_id", id)
            .maybeSingle(),
    ]);

    if (!profile) {
        return { title: "Jugador — Pachanga" };
    }

    const title = `${profile.username ?? "Jugador"} — ${posicionDe(profile.position)} · Pachanga`;
    const description = `${seasonStats?.elo_rating ?? 1000} RP · ${plural(seasonStats?.matches_played ?? 0, "partido")}`;

    return {
        title,
        description,
        alternates: { canonical: `${BASE_URL}/players/${id}` },
        openGraph: {
            title,
            description,
            type: "profile",
            url: `${BASE_URL}/players/${id}`,
        },
    };
}

export default async function PlayerProfilePage({
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

    const season = await getActiveSeason();
    const isYou = id === user.id;

    const [
        { data: profile },
        { data: stats },
        { data: participations },
        { data: rpHistory },
        { data: conPeto },
        { data: viewerParticipations },
        temporada,
    ] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url, position").eq("id", id).single(),
        supabase
            .from("season_player_stats")
            .select("elo_rating, matches_played, goals_scored, wins, draws, losses, mvps")
            .eq("season_id", season.id)
            .eq("user_id", id)
            .maybeSingle(),
        supabase
            .from("match_participants")
            .select("match_id, team, goals, is_mvp, matches!inner(id, season_id, date, location, status, team_a_score, team_b_score)")
            .eq("user_id", id)
            .eq("matches.season_id", season.id),
        supabase
            .from("rp_history")
            .select("match_id, new_rp, rp_change, created_at")
            .eq("user_id", id)
            .eq("season_id", season.id)
            .order("created_at", { ascending: true }),
        supabase
            .from("match_participants")
            .select("team, matches!inner(date, status)")
            .eq("user_id", id)
            .not("team", "is", null)
            .in("matches.status", ["open", "closed"]),
        isYou
            ? Promise.resolve({ data: null })
            : supabase
                  .from("match_participants")
                  .select("match_id, team, matches!inner(season_id)")
                  .eq("user_id", user.id)
                  .eq("matches.season_id", season.id),
        getTemporada(season.id),
    ]);

    if (!profile) notFound();

    const ahora = new Date();
    const nombre = profile.username || "Desconocido";
    const lineas = lineasCartel(nombre);
    const rp = stats?.elo_rating ?? 1000;
    const partidosJugados = stats?.matches_played ?? 0;
    const goles = stats?.goals_scored ?? 0;
    const mvps = stats?.mvps ?? 0;
    const victorias = stats?.wins ?? 0;
    const empates = stats?.draws ?? 0;
    const derrotas = stats?.losses ?? 0;

    // ─── Partidos terminados, el último primero ───────────────────────────────
    const terminados = (participations ?? [])
        .map((p) => {
            const match = p.matches as unknown as PartidoFicha;
            return {
                ...match,
                team: p.team as MatchParticipant["team"],
                goles: p.goals ?? 0,
                mvp: !!p.is_mvp,
                resultado: resultadoDe(p.team, match.team_a_score, match.team_b_score),
            };
        })
        .filter((m) => m.status === "finished")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const trofeos = terminados.filter((m) => m.mvp);

    const racha = calcularRacha(
        terminados.flatMap((m) => (m.resultado ? [{ resultado: m.resultado, goles: m.goles }] : []))
    );

    const datosJugador: DatosJugador = {
        nombre: profile.username,
        partidos: partidosJugados,
        goles,
        mvps,
        victorias,
        empates,
        derrotas,
        racha,
        posicion: profile.position,
    };

    // ─── La curva: cada punto se cruza con su partido por match_id ────────────
    const porId = new Map(terminados.map((m) => [m.id, m]));
    const puntos: PuntoRP[] = (rpHistory ?? []).map((fila) => {
        const partido = porId.get(fila.match_id);
        return {
            matchId: fila.match_id,
            rp: fila.new_rp,
            delta: fila.rp_change,
            fecha: partido?.date ?? fila.created_at,
            resultado: partido?.resultado ?? null,
        };
    });
    const inicio = puntos.length > 0 ? puntos[0].rp - puntos[0].delta : rp;
    const pico = puntos.reduce((maximo, punto) => Math.max(maximo, punto.rp), inicio);

    // ─── Su peto en el próximo partido con equipos ────────────────────────────
    const proximo = (conPeto ?? [])
        .map((p) => ({
            equipo: equipoDeTeam(p.team),
            fecha: (p.matches as unknown as { date: string }).date,
        }))
        .filter((p) => diasHasta(p.fecha, ahora) >= 0)
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0];
    const equipo = proximo?.equipo ?? null;

    // ─── Puestos ──────────────────────────────────────────────────────────────
    const indiceRanking = clasificados(temporada.filas).findIndex((fila) => fila.id === id);
    const puesto = indiceRanking === -1 ? null : indiceRanking + 1;
    const puestoGoles = ordenar(temporada.filas, "goles").findIndex((fila) => fila.id === id) + 1;
    const esAdmin = temporada.adminUserIds.includes(id);

    const identidad = [
        isYou ? "Tú" : null,
        puesto
            ? `${posicionDe(profile.position)}, ${ordinalCorto(puesto)} del ranking`
            : posicionDe(profile.position),
        partidosJugados < PROVISIONAL_THRESHOLD ? "Provisional" : null,
        esAdmin ? "Admin" : null,
        season.name,
    ].filter((dato) => dato !== null);

    // ─── Historial vs ti ──────────────────────────────────────────────────────
    const h2h = { juntos: 0, contra: 0, tuyas: 0, suyas: 0, empates: 0 };
    if (viewerParticipations) {
        const equipoViewer = new Map(viewerParticipations.map((p) => [p.match_id, p.team]));
        for (const partido of terminados) {
            const miEquipo = equipoViewer.get(partido.id);
            if (!miEquipo || !partido.team || !partido.resultado) continue;
            if (miEquipo === partido.team) {
                h2h.juntos++;
                continue;
            }
            h2h.contra++;
            if (partido.resultado === "V") h2h.suyas++;
            else if (partido.resultado === "D") h2h.tuyas++;
            else h2h.empates++;
        }
    }

    // ─── Goles por mes ────────────────────────────────────────────────────────
    const golesPorMes = new Map<string, GolesMes>();
    for (const partido of [...terminados].reverse()) {
        const { clave, nombre: mes } = mesMadrid(partido.date);
        const actual = golesPorMes.get(clave) ?? { clave, nombre: mes, goles: 0 };
        golesPorMes.set(clave, { ...actual, goles: actual.goles + partido.goles });
    }

    const resumenGrafico =
        puntos.length === 0
            ? `Sin partidos: ${rp} RP`
            : `RP de ${nombre}: de ${inicio} a ${rp} en ${plural(puntos.length, "partido")}, con un pico de ${pico}.`;

    const porcentaje = partidosJugados > 0 ? Math.round((victorias / partidosJugados) * 100) : 0;
    const cifras = [
        { valor: partidosJugados, etiqueta: elegirPlural(partidosJugados, "Partido") },
        {
            valor: goles,
            etiqueta:
                goles === 0 || puestoGoles > 10
                    ? elegirPlural(goles, "Gol")
                    : puestoGoles === 1
                      ? `${elegirPlural(goles, "Gol")}, pichichi`
                      : `${elegirPlural(goles, "Gol")}, ${ordinalCorto(puestoGoles)} pichichi`,
        },
        { valor: mvps, etiqueta: elegirPlural(mvps, "MVP", "MVPs") },
        {
            valor: `${victorias}-${empates}-${derrotas}`,
            etiqueta: partidosJugados > 0 ? `V-E-D, ${porcentaje} % ganados` : "V-E-D",
        },
    ];

    return (
        <div className="flex min-h-[calc(100dvh-var(--barra-superior)-var(--barra-inferior))] flex-col">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: jsonLd({
                        "@context": "https://schema.org",
                        "@type": "Person",
                        name: profile.username ?? "",
                        url: `${BASE_URL}/players/${id}`,
                        description: `${posicionDe(profile.position)} con ${rp} RP`,
                    }),
                }}
            />
            {equipo && <Flood color={equipo} />}

            <section className="px-4 pt-2 pb-6">
                {equipo && proximo && (
                    <p className="t-seccion mb-3">
                        {titularPetoJugador({ equipo, fecha: proximo.fecha, ahora })}
                    </p>
                )}

                <h1
                    className="t-cartel"
                    style={{ "--chars": Math.max(...lineas.map((l) => l.length)) } as CSSProperties}
                >
                    {lineas.map((linea) => (
                        <span key={linea} className="block">
                            {linea}
                        </span>
                    ))}
                </h1>

                <div className="mt-4 flex items-center gap-3">
                    <Avatar
                        src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, profile.avatar_url)}
                        fallback={nombre}
                        size="lg"
                        priority
                    />
                    <p className="min-w-0 text-[15px] leading-snug font-medium">
                        {identidad.map((dato, i) => (
                            <span key={dato} className="whitespace-nowrap">
                                {i > 0 && " · "}
                                {dato}
                            </span>
                        ))}
                    </p>
                </div>

                <p className="t-titular mt-4 text-balance">{titularJugador(datosJugador)}</p>

                <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
                    <span className="t-cifra text-[56px] font-black">{rp} RP</span>
                    {puntos.length > 0 && (
                        <span className="text-[15px] font-medium">
                            {conSigno(rp - inicio)} en {plural(puntos.length, "partido")}
                        </span>
                    )}
                </p>

                <div className="mt-2">
                    <GraficoRP inicio={inicio} puntos={puntos} resumen={resumenGrafico} />
                </div>
            </section>

            <div className={cn("flex-1 bg-background pb-8 text-foreground", SUELO)}>
                <section className="px-4 pt-6">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                        {cifras.map(({ valor, etiqueta }) => (
                            <div key={etiqueta}>
                                <p className="t-cifra text-[56px] font-black">{valor}</p>
                                <p className="t-meta mt-1 text-muted">{etiqueta}</p>
                            </div>
                        ))}
                    </div>

                    <PanenkaDice size={56} className="mt-6">
                        {frasePanenkaJugador({
                            id: `${id}:${terminados[0]?.id ?? season.id}`,
                            ...datosJugador,
                        })}
                    </PanenkaDice>
                </section>

                {(h2h.juntos > 0 || h2h.contra > 0) && (
                    <section className="px-4 pt-10">
                        <div className="flex items-baseline justify-between gap-4">
                            <h2 className="t-seccion">Historial vs ti</h2>
                            <p className="t-meta text-muted">{h2h.contra} en contra</p>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-x-2">
                            {[
                                { valor: h2h.tuyas, etiqueta: "Tuyas" },
                                { valor: h2h.suyas, etiqueta: "Suyas" },
                                { valor: h2h.empates, etiqueta: elegirPlural(h2h.empates, "Empate") },
                                { valor: h2h.juntos, etiqueta: "Juntos" },
                            ].map(({ valor, etiqueta }) => (
                                <div key={etiqueta}>
                                    <p className="t-cifra text-[44px] font-black">{valor}</p>
                                    <p className="t-meta mt-1 text-muted">{etiqueta}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="pt-10">
                    <div className="flex items-baseline justify-between gap-4 px-4 pb-2">
                        <h2 className="t-seccion">Trofeos</h2>
                        {trofeos.length > 0 && <p className="t-cifra text-[30px]">{trofeos.length}</p>}
                    </div>
                    {trofeos.length > 0 ? (
                        <Filas aria-label="Trofeos">
                            {trofeos.map((trofeo) => (
                                <Fila
                                    key={trofeo.id}
                                    href={`/matches/${trofeo.id}`}
                                    inicio={<Trophy size={18} strokeWidth={1.75} aria-hidden="true" />}
                                    nombre="MVP"
                                    detalle={`${diaYMes(trofeo.date)}, ${trofeo.location}`}
                                />
                            ))}
                        </Filas>
                    ) : (
                        <p className="px-4 text-muted">{fraseVacio("trofeos", id)}</p>
                    )}
                </section>

                <section className="px-4 pt-10">
                    <h2 className="t-seccion">Goles por mes</h2>
                    {goles > 0 ? (
                        <GolesPorMes meses={[...golesPorMes.values()]} />
                    ) : (
                        <p className="mt-2 text-muted">{fraseVacio("goles", id)}</p>
                    )}
                </section>

                <section className="pt-10">
                    <h2 className="t-seccion px-4 pb-2">Partidos recientes</h2>
                    {terminados.length > 0 ? (
                        <Filas aria-label="Partidos recientes">
                            {terminados.slice(0, 10).map((partido) => {
                                const suEquipo = equipoDeTeam(partido.team);
                                const marcador =
                                    partido.team_a_score !== null && partido.team_b_score !== null
                                        ? `${partido.team_a_score}-${partido.team_b_score}`
                                        : undefined;
                                return (
                                    <Fila
                                        key={partido.id}
                                        href={`/matches/${partido.id}`}
                                        inicio={
                                            suEquipo ? (
                                                <Peto estado="lleno" equipo={suEquipo} size={20} />
                                            ) : undefined
                                        }
                                        nombre={
                                            <>
                                                {suEquipo && <span className="sr-only">De {suEquipo}. </span>}
                                                {partido.resultado
                                                    ? NOMBRE_RESULTADO[partido.resultado]
                                                    : "Sin resultado"}
                                                {partido.mvp && ", MVP"}
                                            </>
                                        }
                                        detalle={[
                                            diaYMes(partido.date),
                                            partido.goles > 0 ? plural(partido.goles, "gol") : null,
                                            partido.location,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        cifra={marcador}
                                    />
                                );
                            })}
                        </Filas>
                    ) : (
                        <p className="px-4 text-muted">{fraseVacio("historial", id)}</p>
                    )}
                </section>
            </div>
        </div>
    );
}
