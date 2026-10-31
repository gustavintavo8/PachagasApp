"use client";

import { startTransition, useOptimistic, useState } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";
import { cancelMatch, generateTeams, joinMatch, kickPlayer, leaveMatch, markAsPaid } from "../actions";
import { cn } from "@/lib/utils";
import { textoWhatsApp } from "@/lib/titulares";
import type { Match } from "@/lib/types";
import { HojaCancelar } from "./HojaCancelar";
import { HojaCobros } from "./HojaCobros";
import { HojaFecha } from "./HojaFecha";
import { HojaJugador } from "./HojaJugador";
import { HojaOrganizar } from "./HojaOrganizar";
import { HojaResultado } from "./HojaResultado";
import { PartidoCancelado } from "./PartidoCancelado";
import { PartidoEnJuego } from "./PartidoEnJuego";
import { PartidoTerminado } from "./PartidoTerminado";
import {
    aplicarCambio,
    permisos,
    type CambioOptimista,
    type HojaPartido,
    type Participante,
    type PestanaPartido,
} from "./datos";

function PanelCargando() {
    return (
        <div className="space-y-3 px-4 py-6">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-3/4" />
        </div>
    );
}

const MatchChat = dynamic(() => import("@/components/MatchChat").then((mod) => ({ default: mod.MatchChat })), {
    loading: PanelCargando,
});
const MatchPhotos = dynamic(() => import("@/components/MatchPhotos").then((mod) => ({ default: mod.MatchPhotos })), {
    loading: PanelCargando,
});

interface MatchDetailProps {
    match: Match;
    participants: Participante[];
    currentUserId: string;
    organizerName: string;
    organizerAvatarUrl: string | null;
    seasonName: string;
    currentUserProfile: {
        username: string | null;
        avatar_url: string | null;
    };
    isAdmin: boolean;
    adminUserIds: string[];
    /** Origen de la web, del servidor: así el enlace de WhatsApp sale igual al hidratar */
    origen: string;
    /** Hora del servidor, para que el marcado no dependa del reloj del cliente */
    ahora: string;
}

const PESTANAS: { id: PestanaPartido; texto: string }[] = [
    { id: "info", texto: "Info" },
    { id: "chat", texto: "Chat" },
    { id: "fotos", texto: "Fotos" },
];

export function MatchDetail({
    match,
    participants,
    currentUserId,
    organizerName,
    organizerAvatarUrl,
    seasonName,
    currentUserProfile,
    isAdmin,
    adminUserIds,
    origen,
    ahora,
}: MatchDetailProps) {
    const { toast } = useToast();
    const [pestana, setPestana] = useState<PestanaPartido>("info");
    // Chat y Fotos se quedan montados: volver no pierde lo que estabas escribiendo
    const [abiertas, setAbiertas] = useState<PestanaPartido[]>([]);
    const [hoja, setHoja] = useState<HojaPartido | null>(null);
    const [ficha, setFicha] = useState<{ id: string; abierta: boolean } | null>(null);
    // Claves de lo que está en marcha. Varias a la vez: en Cobros se marca a uno tras otro.
    const [ocupados, setOcupados] = useState<string[]>([]);
    const [jugadores, aplicar] = useOptimistic(participants, aplicarCambio);

    const puede = permisos(match, currentUserId, isAdmin);
    const yo = jugadores.find((p) => p.user_id === currentUserId);
    const hayEquipos = jugadores.some((p) => p.team !== null);
    const faltan = Math.max(0, match.max_players - jugadores.length);
    const pagos = jugadores.filter((p) => p.has_paid).length;
    const fichado = jugadores.find((p) => p.user_id === ficha?.id) ?? null;

    const urlPartido = `${origen}/matches/${match.id}`;
    const enlaceWhatsApp = `https://wa.me/?text=${encodeURIComponent(
        textoWhatsApp({
            status: match.status,
            location: match.location,
            date: match.date,
            url: urlPartido,
            faltan,
            rojo: match.team_a_score,
            azul: match.team_b_score,
        })
    )}`;

    /** Toda acción acaba: si el servidor no contesta, el botón vuelve y se avisa. */
    async function ejecutar(
        accion: () => Promise<{ success: boolean; error?: string }>,
        exito?: string
    ): Promise<boolean> {
        try {
            const resultado = await accion();
            if (!resultado.success) {
                toast(resultado.error ?? "No ha salido. Inténtalo otra vez.", "error");
                return false;
            }
            if (exito) toast(exito, "success");
            return true;
        } catch {
            toast("No ha salido. Revisa la conexión e inténtalo otra vez.", "error");
            return false;
        }
    }

    const marcar = (clave: string) => setOcupados((previas) => [...previas, clave]);
    const desmarcar = (clave: string) => setOcupados((previas) => previas.filter((c) => c !== clave));

    /** Se ve al instante y se deshace solo si falla. La marca va fuera de la transición para pintarse ya. */
    function alMomento(
        clave: string,
        cambio: CambioOptimista,
        accion: () => Promise<{ success: boolean; error?: string }>,
        exito?: string
    ) {
        marcar(clave);
        startTransition(async () => {
            aplicar(cambio);
            await ejecutar(accion, exito);
            desmarcar(clave);
        });
    }

    async function conEspera(clave: string, accion: () => Promise<boolean>) {
        marcar(clave);
        const hecho = await accion();
        desmarcar(clave);
        if (hecho) setHoja(null);
    }

    function apuntarme() {
        const jugador: Participante = {
            match_id: match.id,
            user_id: currentUserId,
            team: null,
            goals: 0,
            is_mvp: false,
            has_paid: false,
            profiles: {
                id: currentUserId,
                username: currentUserProfile.username,
                avatar_url: currentUserProfile.avatar_url,
                position: null,
                skill_level: null,
                elo_rating: 1000,
                matches_played: 0,
                goals_scored: 0,
                market_value: null,
            },
        };
        alMomento("apuntarse", { tipo: "entra", jugador }, () => joinMatch(match.id), "Estás dentro");
    }

    function borrarme() {
        alMomento("apuntarse", { tipo: "sale", id: currentUserId }, () => leaveMatch(match.id), "Te has borrado");
    }

    function alternarPago(id: string) {
        const jugador = jugadores.find((p) => p.user_id === id);
        if (!jugador) return;
        const pagado = !jugador.has_paid;
        alMomento(`pago-${id}`, { tipo: "pago", id, pagado }, () => markAsPaid(match.id, id, pagado));
    }

    function expulsar(jugador: Participante) {
        const nombre = jugador.profiles?.username || "Jugador";
        cerrarFicha();
        alMomento(
            "expulsar",
            { tipo: "sale", id: jugador.user_id },
            () => kickPlayer(match.id, jugador.user_id),
            `${nombre} expulsado`
        );
    }

    const verJugador = (id: string) => setFicha({ id, abierta: true });
    // El id se queda para que la hoja no se vacíe mientras baja
    const cerrarFicha = () => setFicha((actual) => actual && { ...actual, abierta: false });

    const generarEquipos = () =>
        conEspera("generar", () => ejecutar(() => generateTeams(match.id), "¡Equipos generados!"));
    const cancelarPartido = () =>
        conEspera("cancelar", () => ejecutar(() => cancelMatch(match.id), "Partido cancelado"));

    function cambiarPestana(id: PestanaPartido) {
        window.scrollTo(0, 0);
        setPestana(id);
        if (id !== "info") setAbiertas((previas) => (previas.includes(id) ? previas : [...previas, id]));
    }

    const pestanas = (
        <nav
            aria-label="Secciones del partido"
            // Pegada arriba: la barra superior se va con el scroll. El ::before tapa la zona de la muesca.
            className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex gap-6 border-b border-border bg-background px-4 before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top,0px)] before:bg-background"
        >
            {PESTANAS.map(({ id, texto }) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => cambiarPestana(id)}
                    aria-current={pestana === id ? "true" : undefined}
                    className={cn(
                        "relative -mb-px flex min-h-11 min-w-11 items-center justify-center font-display text-[21px] font-semibold",
                        pestana === id
                            ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground"
                            : "text-muted hover:text-foreground active:text-foreground"
                    )}
                >
                    {texto}
                </button>
            ))}
        </nav>
    );

    const datosPartido = {
        match,
        jugadores,
        yo,
        faltan,
        pagos,
        hayEquipos,
        puede,
        currentUserId,
        organizerName,
        organizerAvatarUrl,
        seasonName,
        urlPartido,
        enlaceWhatsApp,
        ahora,
        onVerJugador: verJugador,
        onOrganizar: () => setHoja("organizar"),
    };

    return (
        <div>
            {pestana !== "info" && pestanas}

            {pestana === "info" && match.status === "finished" && (
                <PartidoTerminado {...datosPartido} pestanas={pestanas} onPestana={cambiarPestana} />
            )}
            {pestana === "info" && match.status === "cancelled" && (
                <>
                    {pestanas}
                    <PartidoCancelado {...datosPartido} />
                </>
            )}
            {pestana === "info" && (match.status === "open" || match.status === "closed") && (
                <>
                    {pestanas}
                    <PartidoEnJuego
                        {...datosPartido}
                        isOrganizer={puede.organiza}
                        isAdmin={isAdmin}
                        apuntandose={ocupados.includes("apuntarse")}
                        onApuntarme={apuntarme}
                        onBorrarme={borrarme}
                    />
                </>
            )}

            {abiertas.includes("chat") && (
                <div hidden={pestana !== "chat"}>
                    <MatchChat
                        matchId={match.id}
                        currentUserId={currentUserId}
                        currentUserProfile={currentUserProfile}
                    />
                </div>
            )}
            {abiertas.includes("fotos") && (
                <div hidden={pestana !== "fotos"}>
                    <MatchPhotos matchId={match.id} currentUserId={currentUserId} />
                </div>
            )}

            {/* Las hojas no dejan nada en el DOM mientras están cerradas */}
            <HojaOrganizar
                open={hoja === "organizar"}
                onClose={() => setHoja(null)}
                match={match}
                puede={puede}
                hayEquipos={hayEquipos}
                total={jugadores.length}
                pagos={pagos}
                generando={ocupados.includes("generar")}
                onGenerar={generarEquipos}
                onAbrir={setHoja}
            />
            <HojaResultado
                open={hoja === "resultado"}
                onClose={() => setHoja(null)}
                match={match}
                jugadores={jugadores}
            />
            <HojaFecha
                key={match.date}
                open={hoja === "fecha"}
                onClose={() => setHoja(null)}
                match={match}
            />
            <HojaCancelar
                open={hoja === "cancelar"}
                onClose={() => setHoja(null)}
                cancelando={ocupados.includes("cancelar")}
                onCancelar={cancelarPartido}
            />
            <HojaCobros
                open={hoja === "cobros"}
                onClose={() => setHoja(null)}
                jugadores={jugadores}
                pagos={pagos}
                ocupados={ocupados}
                onAlternar={alternarPago}
            />
            <HojaJugador
                open={!!ficha?.abierta && fichado !== null}
                onClose={cerrarFicha}
                jugador={fichado}
                mostrarPago={match.status === "open"}
                esAdmin={fichado !== null && adminUserIds.includes(fichado.user_id)}
                esOrganizador={fichado?.user_id === match.created_by}
                esTu={fichado?.user_id === currentUserId}
                puedeExpulsar={puede.expulsar && fichado?.user_id !== currentUserId}
                onExpulsar={expulsar}
            />
        </div>
    );
}
