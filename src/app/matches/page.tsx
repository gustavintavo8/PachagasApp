import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCommunityAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/seasons";
import { Fila, Filas } from "@/components/Filas";
import { PanenkaDice } from "@/components/PanenkaDice";
import { buttonClasses } from "@/components/ui/Button";
import {
    ERROR_PARTIDOS,
    SIN_TERMINADOS,
    charsRespuesta,
    diaPartido,
    estadoPartido,
    estadoPortada,
    fraseVacio,
    lineaPartido,
    plural,
    recuentoResultados,
    resultadoDe,
} from "@/lib/titulares";
import type { Match, MatchParticipant } from "@/lib/types";
import { MatchesTabs } from "./MatchesTabs";
import { ErrorBloque } from "./ErrorBloque";
import { FilaProximo, HeroProximo, type PartidoProximo } from "./Proximo";
import { BandaTerminado, FilaTerminado, type PartidoTerminado } from "./Resultado";

export const metadata: Metadata = {
    title: "Partidos — Pachanga",
    description: "Explora y únete a partidos de fútbol, y revisa tu historial.",
};

const TOPE_TERMINADOS = 30;
const DESDE_TERMINADOS = "?desde=terminados";

type MiPartido = Pick<MatchParticipant, "team"> & {
    matches: Pick<Match, "team_a_score" | "team_b_score">;
};

export default async function MatchesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const access = await requireCommunityAccess(user);
    if (!access.success) redirect("/access");
    const season = await getActiveSeason();

    // Tres lecturas: con una sola ventana de 30, las fechas lejanas y los cancelados
    // echaban fuera a los terminados. "Tu historial" sale de las mismas filas que /history.
    const [activos, terminados, misPartidos] = await Promise.all([
        supabase
            .from("matches")
            .select("id, date, location, max_players, status, match_participants(user_id, team)")
            .eq("season_id", season.id)
            .in("status", ["open", "closed"])
            .order("date", { ascending: true }),
        supabase
            .from("matches")
            .select(
                "id, date, location, team_a_score, team_b_score, match_participants(user_id, team, goals, is_mvp, profiles(username, position))",
                { count: "exact" }
            )
            .eq("season_id", season.id)
            .eq("status", "finished")
            .order("date", { ascending: false })
            .limit(TOPE_TERMINADOS),
        supabase
            .from("match_participants")
            .select("team, matches!inner(team_a_score, team_b_score)")
            .eq("user_id", user.id)
            .eq("matches.season_id", season.id)
            .eq("matches.status", "finished"),
    ]);

    const ahora = new Date();
    const partidosActivos = (activos.data ?? []) as unknown as PartidoProximo[];
    // El instante, no el día: lo de las 18:00 ya no es próximo a las 20:00, como en el detalle
    const proximos = partidosActivos.filter((m) => new Date(m.date) >= ahora);
    // Se jugaron y nadie ha puesto el resultado: lo último que pasó, primero.
    const sinResultado = partidosActivos.filter((m) => new Date(m.date) < ahora).reverse();
    const [siguiente, ...despues] = proximos;
    const partidosTerminados = (terminados.data ?? []) as unknown as PartidoTerminado[];
    const [ultimo, ...anteriores] = partidosTerminados;
    const totalTerminados = terminados.count ?? partidosTerminados.length;

    const cuentas = recuentoResultados(
        ((misPartidos.data ?? []) as unknown as MiPartido[]).flatMap(({ team, matches }) => {
            const resultado = resultadoDe(team, matches.team_a_score, matches.team_b_score);
            return resultado ? [resultado] : [];
        })
    );

    const tuHistorial = (consulta = "") => (
        <Fila
            href={`/history${consulta}`}
            nombre="Tu historial"
            detalle={misPartidos.error ? undefined : `${plural(cuentas.jugados, "jugado")} · V-E-D`}
            cifra={misPartidos.error ? undefined : `${cuentas.victorias}-${cuentas.empates}-${cuentas.derrotas}`}
        />
    );

    const sinPartido = estadoPortada({ partido: null, yo: user.id, ahora }).respuesta;

    return (
        <div className="pb-6">
            <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-1">
                <h1 className="t-seccion">Partidos</h1>
                <Link href="/matches/new" className={buttonClasses("primary", "sm")}>
                    Nuevo
                </Link>
            </header>

            <MatchesTabs
                totalProximos={activos.error ? null : proximos.length}
                totalTerminados={terminados.error ? null : totalTerminados}
                proximos={
                    <>
                        {activos.error ? (
                            <ErrorBloque>{ERROR_PARTIDOS}</ErrorBloque>
                        ) : siguiente ? (
                            <HeroProximo partido={siguiente} yo={user.id} ahora={ahora} />
                        ) : (
                            <section className="px-4 pb-6 pt-5">
                                <p
                                    className="t-respuesta text-balance"
                                    style={{ "--chars": charsRespuesta(sinPartido) } as CSSProperties}
                                >
                                    {sinPartido}
                                </p>
                                <PanenkaDice className="mt-4">{fraseVacio("partidos", season.id)}</PanenkaDice>
                                <Link
                                    href="/matches/new"
                                    className={buttonClasses("primary", "lg", "mt-5 w-full")}
                                >
                                    Montar partido
                                </Link>
                            </section>
                        )}

                        {sinResultado.length > 0 && (
                            <section className="pb-6">
                                <h2 className="t-seccion px-4 pb-2">Falta el resultado</h2>
                                <Filas>
                                    {sinResultado.map((partido) => (
                                        <Fila
                                            key={partido.id}
                                            href={`/matches/${partido.id}`}
                                            nombre={diaPartido(partido.date, ahora)}
                                            detalle={`${lineaPartido(partido.date, partido.location, ahora)} · ${estadoPartido(partido.status)}`}
                                            cifra={`${partido.match_participants.length}/${partido.max_players}`}
                                        />
                                    ))}
                                </Filas>
                            </section>
                        )}

                        {ultimo && (
                            <section aria-label="Lo último">
                                <BandaTerminado partido={ultimo} yo={user.id} />
                            </section>
                        )}

                        {despues.length > 0 && (
                            <section className="pt-5">
                                <h2 className="t-seccion px-4 pb-2">Después</h2>
                                <Filas aria-label="Más partidos">
                                    {despues.map((partido) => (
                                        <FilaProximo key={partido.id} partido={partido} yo={user.id} ahora={ahora} />
                                    ))}
                                </Filas>
                            </section>
                        )}

                        <Filas className={despues.length > 0 ? "mt-6" : undefined}>{tuHistorial()}</Filas>
                    </>
                }
                terminados={
                    terminados.error ? (
                        <ErrorBloque>{ERROR_PARTIDOS}</ErrorBloque>
                    ) : ultimo ? (
                        <>
                            <BandaTerminado partido={ultimo} yo={user.id} origen={DESDE_TERMINADOS} />
                            <Filas aria-label="Partidos terminados">
                                {tuHistorial(DESDE_TERMINADOS)}
                                {anteriores.map((partido) => (
                                    <FilaTerminado
                                        key={partido.id}
                                        partido={partido}
                                        yo={user.id}
                                        origen={DESDE_TERMINADOS}
                                    />
                                ))}
                            </Filas>
                            {totalTerminados > partidosTerminados.length && (
                                <p className="t-meta px-4 pt-3 text-muted">
                                    Los últimos {partidosTerminados.length} de {totalTerminados}.
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <section className="px-4 pb-6 pt-5">
                                <p className="t-titular text-balance">{SIN_TERMINADOS}</p>
                                <PanenkaDice className="mt-4">{fraseVacio("historial", season.id)}</PanenkaDice>
                            </section>
                            <Filas>{tuHistorial(DESDE_TERMINADOS)}</Filas>
                        </>
                    )
                }
            />
        </div>
    );
}
