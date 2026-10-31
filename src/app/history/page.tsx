import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSeasonSelection, SeasonNotFoundError } from "@/lib/seasons";
import type { Season } from "@/lib/types";
import { SeasonSelector } from "@/components/SeasonSelector";
import { Filas } from "@/components/Filas";
import { PanenkaDice } from "@/components/PanenkaDice";
import { buttonClasses } from "@/components/ui/Button";
import { ErrorBloque } from "@/app/matches/ErrorBloque";
import {
    FilaTerminado,
    TiraForma,
    type ParticipanteTerminado,
    type PartidoTerminado,
} from "@/app/matches/Resultado";
import {
    ERROR_HISTORIAL,
    calcularRacha,
    frasePanenkaJugador,
    fraseVacio,
    resultadoDe,
    titularHistorial,
} from "@/lib/titulares";

export const metadata: Metadata = {
    title: "Historial — Pachanga",
    description: "Tu historial de partidos jugados y resultados.",
};

async function seasonOrNull(slug?: string) {
    try {
        return await resolveSeasonSelection(slug);
    } catch (error) {
        // Una temporada que no existe no es un error de la app: se vuelve a la actual
        if (slug && error instanceof SeasonNotFoundError) return null;
        throw error;
    }
}

export default async function HistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ season?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { season: seasonParam } = await searchParams;
    const season = await seasonOrNull(seasonParam);
    if (!season) redirect("/history");

    const [{ data: stats, error: statsError }, { data: seasons }, { data: participations, error: listError }] =
        await Promise.all([
            supabase
                .from("season_player_stats")
                .select("*")
                .eq("season_id", season.id)
                .eq("user_id", user.id)
                .maybeSingle(),
            supabase
                .from("seasons")
                .select("id, name, slug, status, starts_at, ends_at")
                .order("starts_at", { ascending: false }),
            // Tus partidos de la temporada, con toda la plantilla para poder titular la crónica
            supabase
                .from("match_participants")
                .select(`
                    match_id,
                    matches!inner(
                        id, season_id, date, location, status, team_a_score, team_b_score,
                        match_participants(user_id, team, goals, is_mvp, profiles(username, position))
                    )
                `)
                .eq("user_id", user.id)
                .eq("matches.season_id", season.id),
        ]);

    const seasonOptions = (seasons ?? []) as Season[];
    const finishedMatches = (participations ?? [])
        .map((p) => p.matches as unknown as PartidoTerminado & { status: string })
        .filter((m) => m.status === "finished")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const miFila = (partido: PartidoTerminado): ParticipanteTerminado | undefined =>
        partido.match_participants.find((p) => p.user_id === user.id);

    const historial = finishedMatches.flatMap((partido) => {
        const mia = miFila(partido);
        const resultado = resultadoDe(mia?.team ?? null, partido.team_a_score, partido.team_b_score);
        return resultado ? [{ resultado, goles: mia?.goals ?? 0 }] : [];
    });

    const jugados = stats?.matches_played ?? 0;
    const victorias = stats?.wins ?? 0;
    const empates = stats?.draws ?? 0;
    const derrotas = stats?.losses ?? 0;

    const cabecera = (
        <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-1">
            <h1 className="t-seccion">Historial</h1>
            <SeasonSelector seasons={seasonOptions} selectedSlug={season.slug} name="season" />
        </header>
    );

    if (statsError || listError) {
        return (
            <div className="pb-6">
                {cabecera}
                <ErrorBloque>{ERROR_HISTORIAL}</ErrorBloque>
            </div>
        );
    }

    const fraseJugador = frasePanenkaJugador({
        id: `${user.id}:${finishedMatches[0]?.id ?? season.id}`,
        partidos: jugados,
        goles: stats?.goals_scored ?? 0,
        mvps: stats?.mvps ?? 0,
        victorias,
        empates,
        derrotas,
        racha: calcularRacha(historial),
    });

    return (
        <div className="pb-6">
            {cabecera}

            <div className="px-4 pb-5 pt-3">
                <p className="t-titular text-balance">{titularHistorial({ jugados, victorias, derrotas })}</p>

                {historial.length > 0 && (
                    <TiraForma resultados={[...historial].reverse().map((p) => p.resultado)} className="mt-4" />
                )}

                <dl className="mt-4 grid grid-cols-4 gap-2">
                    {[
                        ["Jugados", jugados],
                        ["Victorias", victorias],
                        ["Empates", empates],
                        ["Derrotas", derrotas],
                    ].map(([etiqueta, valor]) => (
                        <div key={etiqueta} className="flex min-w-0 flex-col-reverse">
                            <dt className="t-meta text-muted">{etiqueta}</dt>
                            <dd className="t-cifra text-[44px]">{valor}</dd>
                        </div>
                    ))}
                </dl>

                {finishedMatches.length > 0 ? (
                    <PanenkaDice size={44} className="mt-5">
                        {fraseJugador}
                    </PanenkaDice>
                ) : (
                    <>
                        <PanenkaDice size={44} className="mt-5">
                            {fraseVacio("historial", season.id)}
                        </PanenkaDice>
                        {season.status === "active" && (
                            <Link href="/matches" className={buttonClasses("outline", "lg", "mt-5 w-full")}>
                                Ver partidos
                            </Link>
                        )}
                    </>
                )}
            </div>

            {finishedMatches.length > 0 && (
                <Filas aria-label="Tus partidos">
                    {finishedMatches.map((partido) => (
                        <FilaTerminado key={partido.id} partido={partido} yo={user.id} />
                    ))}
                </Filas>
            )}
        </div>
    );
}
