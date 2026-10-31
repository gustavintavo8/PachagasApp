import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PanenkaDice } from "@/components/PanenkaDice";
import { PROVISIONAL_THRESHOLD } from "@/lib/elo";
import { getActiveSeason } from "@/lib/seasons";
import {
    frasePanenkaRanking,
    lineaPorDetras,
    rachaDeEquipo,
    titularRanking,
} from "@/lib/titulares";
import { cn } from "@/lib/utils";
import { LeaderboardTabs } from "./LeaderboardTabs";
import { getTemporada } from "./datos";
import { clasificados, ordenar, type FilaRanking } from "./tabla";

export const metadata: Metadata = {
    title: "Ranking — Pachanga",
    description: "Clasificación de los mejores jugadores de la comunidad.",
};

// A 84px, dos líneas. Con más texto serían tres y la tabla se iría de la pantalla.
const MAX_TITULAR_GRANDE = 24;

function rival(fila: FilaRanking | undefined, yo: FilaRanking) {
    if (!fila) return null;
    return { nombre: fila.username, distancia: fila.elo_rating - yo.elo_rating };
}

export default async function LeaderboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const season = await getActiveSeason();
    const { filas, ultimoPartidoId, resultados } = await getTemporada(season.id);

    const tabla = clasificados(filas);
    const miFila = filas.find((fila) => fila.id === user.id);
    const indice = tabla.findIndex((fila) => fila.id === user.id);
    const puesto = indice === -1 ? null : indice + 1;
    const partidos = miFila?.matches_played ?? 0;

    const anterior = miFila && indice > 0 ? rival(tabla[indice - 1], miFila) : null;
    const siguiente = miFila && puesto ? rival(tabla[indice + 1], miFila) : null;

    const titular = titularRanking({
        posicion: puesto,
        totalEnTabla: tabla.length,
        partidos,
        anterior,
        siguiente,
    });

    const [pichichi, segundo] = ordenar(filas, "goles").filter((fila) => fila.goals_scored > 0);
    const frase = frasePanenkaRanking({
        id: ultimoPartidoId ?? season.id,
        pichichi: pichichi && { posicion: pichichi.position },
        segundoGoleador: segundo && { posicion: segundo.position },
        rachaEquipo: rachaDeEquipo(resultados),
        posicion: puesto,
        totalEnTabla: tabla.length,
        partidos,
    });

    // El líder ya dice en el titular quién viene detrás
    const porDetras = puesto && puesto > 1 ? lineaPorDetras(siguiente) : null;
    const balance = miFila ? `${miFila.wins}-${miFila.draws}-${miFila.losses}, V-E-D` : null;
    const lineas = puesto
        ? [`${puesto} de ${tabla.length}`, porDetras ?? balance]
        : ["Provisional", `${partidos} de ${PROVISIONAL_THRESHOLD} partidos`];

    return (
        <>
            <header className="px-4">
                <div className="flex items-baseline justify-between gap-4">
                    <h1 className="t-seccion font-black">Ranking</h1>
                    <p className="text-[15px] leading-tight text-muted">{season.name}</p>
                </div>

                <p
                    className={cn(
                        "t-titular mt-2 font-black text-balance [overflow-wrap:anywhere]",
                        titular.length <= MAX_TITULAR_GRANDE && "text-[length:min(84px,21.5vw)] leading-[0.92]"
                    )}
                >
                    {titular}
                </p>

                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
                    <p className="t-cifra text-[56px] font-black">{miFila?.elo_rating ?? 1000} RP</p>
                    <p className="t-meta pb-1 text-muted">
                        {lineas.map((linea) => (
                            <span key={linea} className="block">
                                {linea}
                            </span>
                        ))}
                    </p>
                </div>

                <PanenkaDice size={44} className="mt-3">
                    {frase}
                </PanenkaDice>
            </header>

            <LeaderboardTabs filas={filas} yo={user.id} vacio={ultimoPartidoId ?? season.id} />
        </>
    );
}
