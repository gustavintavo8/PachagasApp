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
    diaPartido,
    diasHasta,
    estadoPartido,
    estadoPortada,
    fraseVacio,
    lineaPartido,
    plural,
} from "@/lib/titulares";
import { MatchesTabs } from "./MatchesTabs";
import { ErrorBloque } from "./ErrorBloque";
import { BloqueProximo, type PartidoProximo } from "./Proximo";
import { FilaTerminado, type PartidoTerminado } from "./Resultado";

export const metadata: Metadata = {
    title: "Partidos — Pachanga",
    description: "Explora y únete a partidos de fútbol, y revisa tu historial.",
};

const TOPE_TERMINADOS = 30;

export default async function MatchesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const access = await requireCommunityAccess(user);
    if (!access.success) redirect("/access");
    const season = await getActiveSeason();

    // Dos lecturas: con una sola ventana de 30, las fechas lejanas y los cancelados
    // echaban fuera a los terminados. Los números de "Tu historial" son los de /history.
    const [activos, terminados, { data: stats }] = await Promise.all([
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
            .from("season_player_stats")
            .select("matches_played, wins, draws, losses")
            .eq("season_id", season.id)
            .eq("user_id", user.id)
            .maybeSingle(),
    ]);

    const ahora = new Date();
    const partidosActivos = (activos.data ?? []) as unknown as PartidoProximo[];
    const proximos = partidosActivos.filter((m) => diasHasta(m.date, ahora) >= 0);
    // Se jugaron y nadie ha puesto el resultado: lo último que pasó, primero.
    const sinResultado = partidosActivos.filter((m) => diasHasta(m.date, ahora) < 0).reverse();
    const partidosTerminados = (terminados.data ?? []) as unknown as PartidoTerminado[];
    const totalTerminados = terminados.count ?? partidosTerminados.length;

    const tuHistorial = (
        <Fila
            href="/history"
            nombre="Tu historial"
            detalle={`${plural(stats?.matches_played ?? 0, "jugado")} · V-E-D`}
            cifra={`${stats?.wins ?? 0}-${stats?.draws ?? 0}-${stats?.losses ?? 0}`}
        />
    );

    return (
        <div className="pb-6">
            <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-1">
                <h1 className="t-seccion">Partidos</h1>
                <Link href="/matches/new" className={buttonClasses("primary", "sm")}>
                    Nuevo
                </Link>
            </header>

            <MatchesTabs
                totalProximos={activos.error ? 0 : proximos.length}
                totalTerminados={terminados.error ? 0 : totalTerminados}
                proximos={
                    <>
                        {activos.error ? (
                            <ErrorBloque>{ERROR_PARTIDOS}</ErrorBloque>
                        ) : proximos.length > 0 ? (
                            <ul aria-label="Próximos partidos">
                                {proximos.map((partido, i) => (
                                    <BloqueProximo
                                        key={partido.id}
                                        partido={partido}
                                        yo={user.id}
                                        ahora={ahora}
                                        destacado={i === 0}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <section className="border-b border-border px-4 pb-6 pt-5">
                                <p className="t-titular text-balance">
                                    {estadoPortada({ partido: null, yo: user.id, ahora }).respuesta}
                                </p>
                                <PanenkaDice className="mt-4">{fraseVacio("partidos", season.id)}</PanenkaDice>
                                <Link
                                    href="/matches/new"
                                    className={buttonClasses("outline", "lg", "mt-5 w-full")}
                                >
                                    Montar partido
                                </Link>
                            </section>
                        )}

                        {sinResultado.length > 0 && (
                            <section className="mt-6">
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

                        <section className="mt-6">
                            {partidosTerminados.length > 0 && <h2 className="t-seccion px-4 pb-2">Lo último</h2>}
                            <Filas>
                                {partidosTerminados.length > 0 && (
                                    <FilaTerminado partido={partidosTerminados[0]} yo={user.id} />
                                )}
                                {tuHistorial}
                            </Filas>
                        </section>
                    </>
                }
                terminados={
                    terminados.error ? (
                        <ErrorBloque>{ERROR_PARTIDOS}</ErrorBloque>
                    ) : partidosTerminados.length > 0 ? (
                        <>
                            <ul aria-label="Partidos terminados">
                                {tuHistorial}
                                {partidosTerminados.map((partido) => (
                                    <FilaTerminado key={partido.id} partido={partido} yo={user.id} />
                                ))}
                            </ul>
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
                            <Filas>{tuHistorial}</Filas>
                        </>
                    )
                }
            />
        </div>
    );
}
