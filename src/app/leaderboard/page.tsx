import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PanenkaDice } from "@/components/PanenkaDice";
import { PROVISIONAL_THRESHOLD } from "@/lib/elo";
import { getActiveSeason } from "@/lib/seasons";
import {
    frasePanenkaRanking,
    MAX_TITULAR,
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

    return (
        <>
            <header className="px-4 pt-2">
                <div className="flex items-baseline justify-between gap-4">
                    <h1 className="t-seccion font-black">Ranking</h1>
                    <p className="text-[15px] leading-tight text-muted">{season.name}</p>
                </div>

                <p
                    className={cn(
                        "t-titular mt-6 font-black text-balance [overflow-wrap:anywhere]",
                        // La frase larga de quien aún no cuenta no puede empujar la tabla fuera de la pantalla
                        titular.length <= MAX_TITULAR && "text-[length:min(84px,21.5vw)] leading-[0.92]"
                    )}
                >
                    {titular}
                </p>

                <div className="mt-6 grid grid-cols-[auto_1fr] gap-x-8">
                    {/* Sin .º: por encima de décimo el titular ya lo dice con esa misma cifra */}
                    <p className="t-cifra text-[64px] font-black">
                        {puesto ?? partidos}
                        <span className="t-meta ml-1.5 font-sans text-muted">
                            de {puesto ? tabla.length : PROVISIONAL_THRESHOLD}
                        </span>
                    </p>
                    <p className="t-cifra text-[64px] font-black">{miFila?.elo_rating ?? 1000} RP</p>
                    <p className="t-meta mt-1 text-muted">{puesto ? "En la tabla" : "Para contar"}</p>
                    <p className="t-meta mt-1 text-muted">{puesto ? (porDetras ?? balance) : "Provisional"}</p>
                </div>

                <PanenkaDice size={56} className="mt-6">
                    {frase}
                </PanenkaDice>
            </header>

            <LeaderboardTabs filas={filas} yo={user.id} vacio={ultimoPartidoId ?? season.id} />
        </>
    );
}
