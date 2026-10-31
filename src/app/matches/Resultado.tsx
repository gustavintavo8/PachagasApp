import Link from "next/link";
import { Fila } from "@/components/Filas";
import { Panenka } from "@/components/Panenka";
import { cn } from "@/lib/utils";
import {
    detalleTerminado,
    participanteCronica,
    resultadoDe,
    titularCronica,
    type PartidoRacha,
} from "@/lib/titulares";
import type { Match, MatchParticipant, Profile } from "@/lib/types";

type Resultado = PartidoRacha["resultado"];

export type ParticipanteTerminado = Pick<MatchParticipant, "user_id" | "team" | "goals" | "is_mvp"> & {
    profiles?: Pick<Profile, "username" | "position"> | null;
};

export type PartidoTerminado = Pick<Match, "id" | "date" | "location" | "team_a_score" | "team_b_score"> & {
    match_participants: ParticipanteTerminado[];
};

// Sin color: lo que manda es la luz. Encendida, gris y apagada.
const MARCA: Record<Resultado, string> = {
    V: "bg-foreground text-background",
    E: "bg-surface-hover text-foreground",
    D: "border-2 border-surface-hover text-muted",
};

const NOMBRE: Record<Resultado, string> = { V: "Victoria", E: "Empate", D: "Derrota" };

export function MarcaResultado({ resultado }: { resultado: Resultado | null }) {
    if (!resultado) return <span aria-hidden="true" className="block size-9" />;
    return (
        <span
            role="img"
            aria-label={NOMBRE[resultado]}
            className={cn("t-cifra flex size-9 items-center justify-center text-[22px]", MARCA[resultado])}
        >
            {resultado}
        </span>
    );
}

/** La temporada de un vistazo, el último a la derecha. Con muchos partidos, sin letras. */
export function TiraForma({ resultados, className }: { resultados: Resultado[]; className?: string }) {
    const conLetra = resultados.length <= 14;
    return (
        <div
            role="img"
            aria-label={`Forma, el último a la derecha: ${resultados.map((r) => NOMBRE[r].toLowerCase()).join(", ")}`}
            className={cn("flex gap-0.5", className)}
        >
            {resultados.map((resultado, i) => (
                <span
                    key={i}
                    aria-hidden="true"
                    className={cn(
                        "t-cifra flex h-12 min-w-0 max-w-[72px] flex-1 items-center justify-center text-[24px]",
                        MARCA[resultado]
                    )}
                >
                    {conLetra && resultado}
                </span>
            ))}
        </div>
    );
}

/** La banda 5-10 en pequeño. El reparto es el del Marcador: 28-72 %, 0-0 al medio. */
export function MiniMarcador({ rojo, azul }: { rojo: number | null; azul: number | null }) {
    if (rojo === null || azul === null) {
        return (
            <span
                role="img"
                aria-label="Sin resultado"
                className="flex h-12 w-[88px] border border-border-hover text-muted min-[360px]:w-[104px]"
            >
                <span className="flex flex-1 items-center justify-center">–</span>
                <span className="flex flex-1 items-center justify-center">–</span>
            </span>
        );
    }

    const total = rojo + azul;
    const costura = total === 0 ? 50 : Math.min(72, Math.max(28, (rojo / total) * 100));

    return (
        <span
            role="img"
            aria-label={`Rojo ${rojo}, Azul ${azul}`}
            className="flex h-12 w-[88px] text-accent-hover min-[360px]:w-[104px]"
        >
            <span className="flex items-center justify-center bg-rojo" style={{ width: `${costura}%` }}>
                {rojo}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-center bg-azul">{azul}</span>
        </span>
    );
}

function lecturaTerminado(partido: PartidoTerminado, yo: string) {
    const mia = partido.match_participants.find((p) => p.user_id === yo);
    return {
        jugado: !!mia,
        resultado: resultadoDe(mia?.team ?? null, partido.team_a_score, partido.team_b_score),
        titular: titularCronica({
            id: partido.id,
            rojo: partido.team_a_score,
            azul: partido.team_b_score,
            participantes: partido.match_participants.map(participanteCronica),
        }).titular,
        detalle: detalleTerminado({
            fecha: partido.date,
            lugar: partido.location,
            jugado: !!mia,
            team: mia?.team ?? null,
            goles: mia?.goals ?? 0,
            mvp: mia?.is_mvp ?? false,
        }),
    };
}

interface TerminadoProps {
    partido: PartidoTerminado;
    yo: string;
    /** Consulta del enlace, para que la flecha del partido vuelva a esta lista: "?desde=terminados" */
    origen?: string;
}

export function FilaTerminado({ partido, yo, origen = "" }: TerminadoProps) {
    const { jugado, resultado, titular, detalle } = lecturaTerminado(partido, yo);

    return (
        <Fila
            href={`/matches/${partido.id}${origen}`}
            className="py-3"
            inicio={<MarcaResultado resultado={resultado} />}
            nombre={
                <span
                    className={cn(
                        "line-clamp-2 whitespace-normal font-display text-[22px] font-extrabold leading-[1.05]",
                        !jugado && "text-muted"
                    )}
                >
                    {titular}
                </span>
            }
            // Dos líneas: el peto, el MVP y los goles no se pueden quedar en puntos suspensivos
            detalle={<span className="line-clamp-2 whitespace-normal">{detalle}</span>}
            cifra={<MiniMarcador rojo={partido.team_a_score} azul={partido.team_b_score} />}
        />
    );
}

/**
 * El último resultado, a sangre: los dos campos con la costura en su sitio y las cifras
 * pegadas a ella. Panenka se queda en el campo grande, que es donde siempre cabe.
 */
export function BandaTerminado({ partido, yo, origen = "" }: TerminadoProps) {
    const { team_a_score: rojo, team_b_score: azul } = partido;
    const { jugado, resultado, titular, detalle } = lecturaTerminado(partido, yo);
    const conResultado = rojo !== null && azul !== null;
    const total = (rojo ?? 0) + (azul ?? 0);
    const costura = total === 0 ? 50 : Math.min(72, Math.max(28, ((rojo ?? 0) / total) * 100));
    const cifra = "t-marcador text-[length:min(76px,19vw)]";

    return (
        <Link href={`/matches/${partido.id}${origen}`} className="block select-none active:bg-surface">
            <span
                role="img"
                aria-label={conResultado ? `Rojo ${rojo}, Azul ${azul}` : "Sin resultado"}
                className={cn("relative grid h-24", conResultado ? "text-accent-hover" : "text-muted")}
                style={{ gridTemplateColumns: `${costura}% 1fr` }}
            >
                <span
                    className={cn(
                        "flex items-center justify-end pr-3.5",
                        conResultado ? "bg-rojo" : "bg-surface"
                    )}
                >
                    <span className={cifra}>{rojo ?? "–"}</span>
                </span>
                <span
                    className={cn(
                        "flex items-center border-l-2 pl-3.5",
                        conResultado ? "border-accent-hover bg-azul" : "border-border-hover bg-surface"
                    )}
                >
                    <span className={cifra}>{azul ?? "–"}</span>
                </span>
                {conResultado && (
                    <Panenka
                        size={80}
                        className={cn("absolute top-2", costura > 50 ? "left-3" : "right-3")}
                    />
                )}
            </span>

            <span className="flex items-start gap-3 px-4 py-3">
                {resultado && <MarcaResultado resultado={resultado} />}
                <span className="min-w-0 flex-1">
                    <span className={cn("t-seccion line-clamp-2 block", !jugado && "text-muted")}>{titular}</span>
                    <span className="t-meta mt-0.5 block truncate text-muted">{detalle}</span>
                </span>
            </span>
        </Link>
    );
}
