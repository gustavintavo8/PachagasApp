import { Fila } from "@/components/Filas";
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

export function FilaTerminado({ partido, yo }: { partido: PartidoTerminado; yo: string }) {
    const mia = partido.match_participants.find((p) => p.user_id === yo);
    const { titular } = titularCronica({
        id: partido.id,
        rojo: partido.team_a_score,
        azul: partido.team_b_score,
        participantes: partido.match_participants.map(participanteCronica),
    });

    return (
        <Fila
            href={`/matches/${partido.id}`}
            className="py-3"
            inicio={<MarcaResultado resultado={resultadoDe(mia?.team ?? null, partido.team_a_score, partido.team_b_score)} />}
            nombre={
                <span
                    className={cn(
                        "line-clamp-2 whitespace-normal font-display text-[22px] font-extrabold leading-[1.05]",
                        !mia && "text-muted"
                    )}
                >
                    {titular}
                </span>
            }
            detalle={detalleTerminado({
                fecha: partido.date,
                lugar: partido.location,
                jugado: !!mia,
                team: mia?.team ?? null,
                goles: mia?.goals ?? 0,
                mvp: mia?.is_mvp ?? false,
            })}
            cifra={<MiniMarcador rojo={partido.team_a_score} azul={partido.team_b_score} />}
        />
    );
}
