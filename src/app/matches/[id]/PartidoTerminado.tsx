"use client";

import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CampoEquipos, nombreEnCampo } from "@/components/Campo";
import { Flood } from "@/components/Flood";
import { Marcador } from "@/components/Marcador";
import { PanenkaDice } from "@/components/PanenkaDice";
import { cn } from "@/lib/utils";
import { fechaCorta, participanteCronica, titularCronica } from "@/lib/titulares";
import { Compartir, PieInfo, type PropsInfo } from "./Compartir";
import { aJugadorCampo, bandaEquipo, ListaSinEquipo } from "./jugadores";
import { nombreDe, type Participante, type PestanaPartido } from "./datos";

const MvpVoting = dynamic(() => import("@/components/MvpVoting").then((mod) => ({ default: mod.MvpVoting })), {
    loading: () => <div className="skeleton mx-4 h-32" />,
});

// El Flood pone <main> en modo campo de color. Debajo del Marcador volvemos a la noche.
const NOCHE = {
    "--surface": "#141414",
    "--surface-hover": "#1f1f1f",
    "--border": "#2a2a2a",
    "--border-hover": "#4a4a4a",
    "--muted": "#a8a8a8",
    "--foreground": "#f4f4f4",
} as CSSProperties;

function Goleadores({ equipo, enDosColumnas }: { equipo: Participante[]; enDosColumnas: boolean }) {
    const goleadores = equipo
        .filter((p) => p.goals > 0)
        .sort((a, b) => b.goals - a.goals || nombreDe(a).localeCompare(nombreDe(b), "es"));

    return (
        <ul className={cn("grid gap-x-4", enDosColumnas && "grid-cols-2")}>
            {goleadores.map((p) => (
                <li key={p.user_id} className="flex h-7 items-center justify-between gap-2 text-[15px] font-medium">
                    <span className="min-w-0 truncate">{nombreEnCampo(nombreDe(p))}</span>
                    <span className="flex-none font-bold tabular-nums">{p.goals}</span>
                </li>
            ))}
        </ul>
    );
}

export function PartidoTerminado({
    match,
    jugadores,
    hayEquipos,
    puede,
    currentUserId,
    organizerName,
    organizerAvatarUrl,
    seasonName,
    urlPartido,
    enlaceWhatsApp,
    onVerJugador,
    onOrganizar,
    pestanas,
    onPestana,
}: PropsInfo & { pestanas: ReactNode; onPestana: (id: PestanaPartido) => void }) {
    const rojo = match.team_a_score;
    const azul = match.team_b_score;
    const conResultado = rojo !== null && azul !== null;
    const { titular, frasePanenka } = titularCronica({
        id: match.id,
        rojo,
        azul,
        participantes: jugadores.map(participanteCronica),
    });
    const ganador = conResultado && rojo !== azul ? (rojo > azul ? "rojo" : "azul") : null;

    const delRojo = jugadores.filter((p) => p.team === "A");
    const delAzul = jugadores.filter((p) => p.team === "B");
    const sinEquipo = jugadores.filter((p) => p.team === null);
    const hayGoleadores = jugadores.some((p) => p.goals > 0);

    // El mismo reparto que el Marcador: el campo ancho admite dos columnas de nombres
    const total = (rojo ?? 0) + (azul ?? 0);
    const costura = total === 0 ? 50 : ((rojo ?? 0) / total) * 100;
    const dosColumnasAzul = costura <= 40 && delAzul.filter((p) => p.goals > 0).length > 4;
    const dosColumnasRojo = costura >= 60 && delRojo.filter((p) => p.goals > 0).length > 4;

    const campo = (p: Participante) => aJugadorCampo(p, currentUserId, false);
    const fecha = (
        <p className="t-meta mt-1.5 [overflow-wrap:anywhere]">
            {fechaCorta(match.date)} · {match.location}
        </p>
    );

    return (
        <div className="flex min-h-[calc(100dvh-var(--barra-inferior))] flex-col">
            {ganador && <Flood color={ganador} />}

            {conResultado ? (
                // En escritorio los enlaces de la barra caerían sobre la costura: ahí no pasa por debajo
                <Marcador rojo={rojo} azul={azul} className="bajo-barra md:mt-0 md:pt-0">
                    {/* Banda negra: tapa la costura para que el titular no quede partido por ella */}
                    <div className="bg-background px-4 py-3 text-white">
                        <h1 className="t-titular text-[clamp(34px,10.5vw,44px)] leading-none">{titular}</h1>
                        {fecha}
                    </div>
                    {hayGoleadores && (
                        <div
                            aria-label="Goleadores"
                            className="mt-3 grid"
                            style={{ gridTemplateColumns: "var(--costura) minmax(0, 1fr)" }}
                        >
                            <div className="min-w-0 pl-4 pr-3">
                                <Goleadores equipo={delRojo} enDosColumnas={dosColumnasRojo} />
                            </div>
                            <div className="min-w-0 pl-[18px] pr-4">
                                <Goleadores equipo={delAzul} enDosColumnas={dosColumnasAzul} />
                            </div>
                        </div>
                    )}
                </Marcador>
            ) : (
                <header className="px-4 pt-3">
                    <h1 className="t-titular text-[min(104px,26.6vw)] font-black leading-[0.95]">{titular}</h1>
                    {fecha}
                </header>
            )}

            <div style={NOCHE} className="flex-1 bg-background text-foreground">
                {/* La cara ya está en el punto de saque: aquí solo la frase y la firma */}
                <PanenkaDice firma className="px-4 pb-4 pt-3 [&>svg]:hidden">
                    {frasePanenka}
                </PanenkaDice>

                {pestanas}

                <div className="pt-4">
                    <MvpVoting
                        matchId={match.id}
                        currentUserId={currentUserId}
                        participants={jugadores}
                        matchFinishedAt={match.finished_at}
                        matchDate={match.date}
                        canManage={puede.gestiona}
                    />
                </div>

                <div className="mt-2 flex items-center justify-between px-4 text-base font-medium">
                    <button
                        type="button"
                        onClick={() => onPestana("fotos")}
                        className="pulsable flex min-h-11 select-none items-center gap-0.5 active:text-muted"
                    >
                        Fotos
                        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onPestana("chat")}
                        className="pulsable flex min-h-11 select-none items-center gap-0.5 active:text-muted"
                    >
                        Chat del partido
                        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </div>

                {hayEquipos && (
                    <section aria-label="Equipos" className="mt-4">
                        <CampoEquipos
                            rojo={delRojo.map(campo)}
                            azul={delAzul.map(campo)}
                            bandaRojo={bandaEquipo(delRojo)}
                            bandaAzul={bandaEquipo(delAzul)}
                            onPulsar={onVerJugador}
                        />
                    </section>
                )}
                {sinEquipo.length > 0 && <ListaSinEquipo jugadores={sinEquipo} onVerJugador={onVerJugador} />}

                <Compartir urlPartido={urlPartido} enlaceWhatsApp={enlaceWhatsApp} match={match} className="mt-4" />
                <PieInfo
                    match={match}
                    seasonName={seasonName}
                    organizerName={organizerName}
                    organizerAvatarUrl={organizerAvatarUrl}
                    organizasTu={puede.organiza}
                />
                {puede.repetir && (
                    <div className="px-4 pb-4 pt-2">
                        <Button type="button" variant="outline" size="lg" className="w-full" onClick={onOrganizar}>
                            Organizar
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
