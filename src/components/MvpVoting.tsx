"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkAndResolveExpiredMvp, forceResolveMvp, voteForMvp } from "@/app/matches/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Fila, Filas } from "@/components/Filas";
import { Hoja } from "@/components/Hoja";
import { PanenkaDice } from "@/components/PanenkaDice";
import { Peto } from "@/components/Peto";
import { MVP_VOTING_WINDOW_MS } from "@/lib/constantes";
import {
    desenlaceMvp,
    equipoDeTeam,
    fraseNoJugaste,
    nombresBaldosa,
    plazoVotacion,
    plural,
    recuentoMvp,
    textoVotantes,
    type Equipo,
    type RecuentoMvp,
    type VotoMvp,
} from "@/lib/titulares";

interface Participant {
    user_id: string;
    is_mvp?: boolean;
    team?: "A" | "B" | null;
    goals?: number;
    profiles: {
        username: string | null;
        avatar_url: string | null;
    };
}

interface MvpVotingProps {
    matchId: string;
    currentUserId: string;
    participants: Participant[];
    matchFinishedAt: string | null;
    matchDate: string;
    canManage?: boolean;
}

// Tres candidatos y «Otro», como en el mockup. Con cuatro caben todos.
const MAX_BALDOSAS = 4;

// A sangre aunque el contenedor traiga márgenes: el ancho de la pantalla o el de la columna
const A_SANGRE = "w-[min(100vw,640px)] ml-[calc(50%-min(50vw,320px))]";

const CAMPO: Record<Equipo, string> = {
    rojo: "bg-rojo text-[#ffffff]",
    azul: "bg-azul text-[#ffffff]",
};

function campoDe(participante: Participant) {
    const equipo = equipoDeTeam(participante.team ?? null);
    return equipo ? CAMPO[equipo] : "bg-surface text-foreground";
}

function nombreDe(participante: Participant) {
    return participante.profiles?.username || "Anónimo";
}

function columnasDe(columnas: number) {
    return { gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` };
}

// El nombre manda en el tamaño: «Maximiliano» tiene que caber en un cuarto de pantalla
function cuerpoBaldosa(nombre: string, columnas: number) {
    const ancho = `calc(min(100vw, 640px) / ${columnas} - 20px)`;
    return { fontSize: `max(15px, min(24px, calc(${ancho} / ${(nombre.length * 0.4).toFixed(2)})))` };
}

const BALDOSA =
    "flex h-14 min-w-0 items-center justify-center px-1 text-center font-display font-extrabold leading-none";

function Cabecera({ detalle }: { detalle?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-seccion text-[34px]">¿MVP?</h2>
            {detalle && <p className="t-meta text-right text-muted">{detalle}</p>}
        </div>
    );
}

function Pie({
    children,
    finalizar,
    finalizarDesactivado,
}: {
    children: ReactNode;
    finalizar?: () => void;
    finalizarDesactivado: boolean;
}) {
    return (
        <div className="mt-2 flex min-h-11 items-center justify-between gap-4">
            <p className="t-meta min-w-0 text-muted tabular-nums">{children}</p>
            {finalizar && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-mr-3 shrink-0"
                    disabled={finalizarDesactivado}
                    onClick={finalizar}
                >
                    Finalizar ya
                </Button>
            )}
        </div>
    );
}

function Abierta({
    matchId,
    participants,
    yoId,
    plazo,
    votos,
    miVoto,
    votandoA,
    onVotar,
    onFinalizar,
}: {
    matchId: string;
    participants: Participant[];
    yoId: string;
    plazo: string;
    votos: number;
    miVoto: VotoMvp | undefined;
    votandoA: string | null;
    onVotar: (userId: string) => void;
    onFinalizar?: () => void;
}) {
    const [verOtros, setVerOtros] = useState(false);

    const juegas = participants.some((p) => p.user_id === yoId);
    const contador = textoVotantes(votos, participants.length);
    const pie = { finalizar: onFinalizar, finalizarDesactivado: votos === 0 };

    const votado = participants.find((p) => p.user_id === miVoto?.voted_for);
    if (votado) {
        return (
            <>
                <Cabecera detalle={plazo} />
                <div role="status" className={`mt-3 flex h-14 items-center justify-between gap-3 px-4 ${campoDe(votado)}`}>
                    <span className="truncate font-display text-[26px] font-extrabold leading-none">
                        {nombreDe(votado)}
                    </span>
                    <span className="t-meta flex shrink-0 items-center gap-1.5">
                        <Check size={18} strokeWidth={1.75} aria-hidden="true" />
                        Tu voto
                    </span>
                </div>
                <Pie {...pie}>El resultado, al cerrar. {contador}</Pie>
            </>
        );
    }

    if (!juegas) {
        return (
            <>
                <Cabecera detalle={plazo} />
                <PanenkaDice size={40} className="mt-3">
                    {fraseNoJugaste(matchId)}
                </PanenkaDice>
                <Pie {...pie}>{contador}</Pie>
            </>
        );
    }

    const candidatos = participants
        .filter((p) => p.user_id !== yoId)
        .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
    const nombres = nombresBaldosa(candidatos.map((p) => p.profiles?.username));
    // Si no caben, los tres con más goles y el resto en la hoja
    const conOtro = candidatos.length > MAX_BALDOSAS;
    const enBaldosa = conOtro ? candidatos.slice(0, MAX_BALDOSAS - 1) : candidatos;
    const resto = conOtro ? candidatos.slice(MAX_BALDOSAS - 1) : [];
    const columnas = enBaldosa.length + (conOtro ? 1 : 0);
    const pulsando = votandoA !== null;

    return (
        <>
            <Cabecera detalle={plazo} />
            <div className="mt-3 grid gap-0.5" style={columnasDe(columnas)}>
                {enBaldosa.map((p, i) => (
                    <button
                        key={p.user_id}
                        type="button"
                        onClick={() => onVotar(p.user_id)}
                        disabled={pulsando}
                        aria-busy={votandoA === p.user_id || undefined}
                        aria-label={`Votar a ${nombreDe(p)}`}
                        style={cuerpoBaldosa(nombres[i], columnas)}
                        className={`pulsable select-none ${BALDOSA} ${campoDe(p)} active:bg-foreground active:text-background ${pulsando && votandoA !== p.user_id ? "opacity-50" : ""}`}
                    >
                        <span className="truncate">{nombres[i]}</span>
                    </button>
                ))}
                {conOtro && (
                    <button
                        type="button"
                        onClick={() => setVerOtros(true)}
                        disabled={pulsando}
                        style={cuerpoBaldosa("Otro", columnas)}
                        className={`pulsable select-none ${BALDOSA} bg-surface text-foreground active:bg-foreground active:text-background ${pulsando ? "opacity-50" : ""}`}
                    >
                        Otro
                    </button>
                )}
            </div>
            <Pie {...pie}>{contador}</Pie>

            <Hoja
                open={verOtros}
                onClose={() => setVerOtros(false)}
                title="¿Quién fue el MVP?"
                description="Un voto por partido y no se cambia."
            >
                <Filas aria-label="Otros candidatos">
                    {resto.map((p) => (
                        <Fila
                            key={p.user_id}
                            nombre={nombreDe(p)}
                            detalle={p.goals ? plural(p.goals, "gol") : undefined}
                            inicio={<Peto estado="lleno" equipo={equipoDeTeam(p.team ?? null)} size={22} />}
                            onClick={() => {
                                setVerOtros(false);
                                onVotar(p.user_id);
                            }}
                        />
                    ))}
                </Filas>
            </Hoja>
        </>
    );
}

function Resultado({
    matchId,
    participants,
    yoId,
    ganador,
    recuento,
    votos,
    miVoto,
}: {
    matchId: string;
    participants: Participant[];
    yoId: string;
    ganador: Participant | undefined;
    recuento: RecuentoMvp;
    votos: number;
    miVoto: VotoMvp | undefined;
}) {
    const empatados = ganador ? [] : participants.filter((p) => recuento.lideres.includes(p.user_id));
    const desenlace = desenlaceMvp({
        id: matchId,
        ganador: ganador ? nombreDe(ganador) : null,
        esTuyo: ganador?.user_id === yoId,
        empatados: empatados.length,
        maximo: recuento.maximo,
    });
    const votosGanador = ganador ? (recuento.votos[ganador.user_id] ?? 0) : 0;
    const otrosVotados = participants
        .filter((p) => (recuento.votos[p.user_id] ?? 0) > 0 && p.user_id !== ganador?.user_id)
        .sort((a, b) => (recuento.votos[b.user_id] ?? 0) - (recuento.votos[a.user_id] ?? 0));
    const nombresEmpate = nombresBaldosa(empatados.map((p) => p.profiles?.username));
    const columnasEmpate = Math.min(empatados.length, MAX_BALDOSAS);

    return (
        <>
            {ganador ? (
                <div className={`-mx-4 -mt-5 px-4 py-5 ${campoDe(ganador)}`}>
                    <h2 className="t-titular [overflow-wrap:anywhere]">{desenlace.titular}</h2>
                    {votosGanador > 0 && <p className="t-meta mt-2 tabular-nums">{plural(votosGanador, "voto")}</p>}
                </div>
            ) : (
                <>
                    <Cabecera detalle="Votación cerrada" />
                    <p className="t-titular mt-2">{desenlace.titular}</p>
                    {empatados.length > 1 && (
                        <div className="mt-3 grid gap-0.5" style={columnasDe(columnasEmpate)}>
                            {empatados.map((p, i) => (
                                <div
                                    key={p.user_id}
                                    style={cuerpoBaldosa(nombresEmpate[i], columnasEmpate)}
                                    className={`${BALDOSA} ${campoDe(p)}`}
                                >
                                    <span className="truncate">{nombresEmpate[i]}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <PanenkaDice size={40} className="mt-4">
                {desenlace.frase}
            </PanenkaDice>

            {otrosVotados.length > 0 && (
                <Filas aria-label="Votos" className="-mx-4 mt-4">
                    {otrosVotados.map((p) => {
                        const tuya = p.user_id === yoId;
                        return (
                            <Fila
                                key={p.user_id}
                                tu={tuya}
                                nombre={tuya ? `${nombreDe(p)}, tú` : nombreDe(p)}
                                detalle={miVoto?.voted_for === p.user_id ? "Tu voto" : undefined}
                                inicio={<Peto estado="lleno" equipo={equipoDeTeam(p.team ?? null)} size={22} />}
                                cifra={recuento.votos[p.user_id]}
                            />
                        );
                    })}
                </Filas>
            )}

            {votos > 0 && <p className="t-meta mt-3 text-muted tabular-nums">{textoVotantes(votos, participants.length)}</p>}
        </>
    );
}

export function MvpVoting({
    matchId,
    currentUserId,
    participants,
    matchFinishedAt,
    matchDate,
    canManage,
}: MvpVotingProps) {
    // Sin finished_at (partidos antiguos) cuenta la fecha del partido, como en las actions
    const inicioPlazo = matchFinishedAt || matchDate;
    const cierre = new Date(inicioPlazo).getTime() + MVP_VOTING_WINDOW_MS;

    const [supabase] = useState(createClient);
    const { toast } = useToast();
    const [votes, setVotes] = useState<VotoMvp[]>([]);
    const [carga, setCarga] = useState<"cargando" | "lista" | "error">("cargando");
    const [intento, setIntento] = useState(0);
    const [ahora, setAhora] = useState(() => Date.now());
    const [votandoA, setVotandoA] = useState<string | null>(null);
    const [confirmarCierre, setConfirmarCierre] = useState(false);
    const [cerrando, setCerrando] = useState(false);
    const resolucionPedida = useRef(false);

    const resuelto = participants.find((p) => p.is_mvp);
    const expirada = ahora > cierre;
    const cerrada = expirada || !!resuelto;
    const juegas = participants.some((p) => p.user_id === currentUserId);
    const miVoto = votes.find((v) => v.voter_id === currentUserId);
    const recuento = recuentoMvp(votes);

    // Si el canal llega antes que la lectura, no se pierde ningún voto
    useEffect(() => {
        let vigente = true;
        supabase
            .from("mvp_votes")
            .select("voter_id, voted_for")
            .eq("match_id", matchId)
            .then(({ data, error }) => {
                if (!vigente) return;
                if (error) {
                    setCarga("error");
                    return;
                }
                const leidos = (data as VotoMvp[]) ?? [];
                setVotes((prev) => [
                    ...leidos,
                    ...prev.filter((v) => !leidos.some((l) => l.voter_id === v.voter_id)),
                ]);
                setCarga("lista");
            });
        return () => {
            vigente = false;
        };
    }, [supabase, matchId, intento]);

    // El plazo cierra solo. Una vez por minuto para que «hoy» y «mañana» sigan siendo ciertos.
    useEffect(() => {
        const faltan = cierre - ahora;
        if (resuelto || faltan < 0) return;
        const espera = window.setTimeout(() => setAhora(Date.now()), Math.min(faltan + 1000, 60_000));
        return () => window.clearTimeout(espera);
    }, [cierre, ahora, resuelto]);

    useEffect(() => {
        const channel = supabase
            .channel(`mvp-votes-${matchId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "mvp_votes",
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    const newVote = payload.new as VotoMvp;
                    setVotes((prev) => {
                        if (prev.some((v) => v.voter_id === newVote.voter_id)) return prev;
                        return [...prev, newVote];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, matchId]);

    // Plazo vencido con votos y sin MVP: se pide resolver una vez por visita
    useEffect(() => {
        if (!expirada || resuelto || votes.length === 0 || resolucionPedida.current) return;
        resolucionPedida.current = true;
        checkAndResolveExpiredMvp(matchId).catch(console.error);
    }, [expirada, resuelto, matchId, votes.length]);

    async function handleVote(votedForUserId: string) {
        if (votandoA || miVoto || cerrada || !juegas) return;
        setVotandoA(votedForUserId);

        try {
            const result = await voteForMvp(matchId, votedForUserId);
            if (!result.success) {
                toast(result.error || "Error al votar", "error");
                return;
            }
            // El canal suele llegar antes que la respuesta: el voto no se cuenta dos veces
            setVotes((prev) =>
                prev.some((v) => v.voter_id === currentUserId)
                    ? prev
                    : [...prev, { voter_id: currentUserId, voted_for: votedForUserId }]
            );
            toast("Voto registrado", "success");
        } catch {
            toast("Error al votar", "error");
        } finally {
            setVotandoA(null);
        }
    }

    async function handleForceResolve() {
        setCerrando(true);
        try {
            const result = await forceResolveMvp(matchId);
            if (!result.success) {
                toast(result.error || "Error al finalizar", "error");
            } else if (recuento.lideres.length > 1) {
                // En empate el servidor no elige a nadie y la votación sigue abierta
                toast("Hay empate, así que la votación sigue abierta", "info");
            } else {
                toast("Votación finalizada", "success");
            }
        } catch {
            toast("Error al finalizar", "error");
        } finally {
            setCerrando(false);
            setConfirmarCierre(false);
        }
    }

    // Con menos de dos jugadores no hay a quién votar
    if (participants.length < 2) return null;

    const ganadorId = resuelto?.user_id ?? (cerrada && recuento.lideres.length === 1 ? recuento.lideres[0] : null);
    const ganador = participants.find((p) => p.user_id === ganadorId);
    const huecos = Math.min(participants.length - (juegas ? 1 : 0), MAX_BALDOSAS);

    return (
        <section aria-label="Votación MVP" className={`${A_SANGRE} px-4 py-5`}>
            {carga === "cargando" ? (
                <div aria-hidden="true">
                    <Cabecera />
                    <div className="mt-3 grid gap-0.5" style={columnasDe(huecos)}>
                        {Array.from({ length: huecos }, (_, i) => (
                            <div key={i} className="skeleton h-14" />
                        ))}
                    </div>
                    <div className="mt-2 flex min-h-11 items-center">
                        <div className="skeleton h-5 w-32" />
                    </div>
                </div>
            ) : carga === "error" ? (
                <>
                    <Cabecera />
                    <div className="mt-3 flex items-center gap-3">
                        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-tarjeta" />
                        <p className="min-w-0 flex-1">No se han podido leer los votos.</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCarga("cargando");
                                setIntento((n) => n + 1);
                            }}
                        >
                            Reintentar
                        </Button>
                    </div>
                </>
            ) : cerrada ? (
                <Resultado
                    matchId={matchId}
                    participants={participants}
                    yoId={currentUserId}
                    ganador={ganador}
                    recuento={recuento}
                    votos={votes.length}
                    miVoto={miVoto}
                />
            ) : (
                <Abierta
                    matchId={matchId}
                    participants={participants}
                    yoId={currentUserId}
                    plazo={plazoVotacion(inicioPlazo, ahora)}
                    votos={votes.length}
                    miVoto={miVoto}
                    votandoA={votandoA}
                    onVotar={handleVote}
                    onFinalizar={canManage ? () => setConfirmarCierre(true) : undefined}
                />
            )}

            <Hoja
                open={confirmarCierre}
                onClose={() => setConfirmarCierre(false)}
                title="¿Cerrar la votación?"
                description="Se cierra ahora y se elige al MVP con los votos que haya."
            >
                <div className="flex gap-2 px-4 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="flex-1"
                        onClick={() => setConfirmarCierre(false)}
                    >
                        Volver
                    </Button>
                    <Button type="button" size="lg" className="flex-1" loading={cerrando} onClick={handleForceResolve}>
                        Finalizar ya
                    </Button>
                </div>
            </Hoja>
        </section>
    );
}
