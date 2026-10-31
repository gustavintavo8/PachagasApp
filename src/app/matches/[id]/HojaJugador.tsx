"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Hoja } from "@/components/Hoja";
import { POSITION_FULL } from "@/lib/positions";
import { getAvatarUrl } from "@/lib/utils";
import { plural } from "@/lib/titulares";
import { nombreDe, type Participante } from "./datos";

function Dato({ cifra, texto }: { cifra: number; texto: string }) {
    return (
        <div>
            <p className="t-cifra text-[40px]">{cifra}</p>
            <p className="t-meta mt-1 text-muted">{texto}</p>
        </div>
    );
}

/** La tarjeta del jugador que antes era un popover del campo. */
export function HojaJugador({
    open,
    onClose,
    jugador,
    mostrarPago,
    esAdmin,
    esOrganizador,
    esTu,
    puedeExpulsar,
    onExpulsar,
}: {
    open: boolean;
    onClose: () => void;
    jugador: Participante | null;
    mostrarPago: boolean;
    esAdmin: boolean;
    esOrganizador: boolean;
    esTu: boolean;
    puedeExpulsar: boolean;
    onExpulsar: (jugador: Participante) => void;
}) {
    const [confirmando, setConfirmando] = useState(false);

    function cerrar() {
        setConfirmando(false);
        onClose();
    }

    const perfil = jugador?.profiles;
    const nombre = jugador ? nombreDe(jugador) : "";
    const puesto = perfil?.position ? POSITION_FULL[perfil.position] : "Sin posición";
    const papeles = [esOrganizador && "Organiza", esAdmin && "Admin", esTu && "Tú"].filter(Boolean).join(" · ");

    return (
        <Hoja open={open} onClose={cerrar} title={nombre} description={puesto}>
            {jugador && (
                <div className="space-y-5 px-4">
                    <div className="flex items-center gap-4">
                        <Avatar
                            src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, perfil?.avatar_url ?? null)}
                            fallback={perfil?.username || "P"}
                            size="xl"
                        />
                        <div className="t-meta min-w-0 space-y-0.5 text-muted">
                            {papeles && <p>{papeles}</p>}
                            {jugador.goals > 0 && (
                                <p className="text-foreground">{plural(jugador.goals, "gol")} en este partido</p>
                            )}
                            {jugador.is_mvp && <p className="font-bold text-foreground">MVP del partido</p>}
                            {mostrarPago && (
                                <p className={jugador.has_paid ? undefined : "text-foreground"}>
                                    {jugador.has_paid ? "Pagado" : "Pendiente de pago"}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 border-y border-border py-4">
                        <Dato cifra={perfil?.elo_rating ?? 1000} texto="RP" />
                        <Dato cifra={perfil?.matches_played ?? 0} texto="Partidos" />
                        <Dato cifra={perfil?.goals_scored ?? 0} texto="Goles" />
                    </div>

                    <div className="space-y-2">
                        <Link
                            href={`/players/${jugador.user_id}`}
                            className={buttonClasses("outline", "lg", "w-full")}
                        >
                            Ver perfil
                        </Link>
                        {puedeExpulsar &&
                            (confirmando ? (
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => {
                                        setConfirmando(false);
                                        onExpulsar(jugador);
                                    }}
                                >
                                    Sí, expulsar a {nombre}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="md"
                                    className="w-full text-tarjeta"
                                    onClick={() => setConfirmando(true)}
                                >
                                    Expulsar a {nombre}
                                </Button>
                            ))}
                    </div>
                </div>
            )}
        </Hoja>
    );
}
