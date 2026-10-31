"use client";

import dynamic from "next/dynamic";
import { Button, buttonClasses } from "@/components/ui/Button";
import { CampoEquipos, CampoPlantilla, nombreEnCampo } from "@/components/Campo";
import { PanenkaDice } from "@/components/PanenkaDice";
import { Peto, type EstadoPeto } from "@/components/Peto";
import { cn } from "@/lib/utils";
import {
    equipoDeTeam,
    estadoPortada,
    fechaCorta,
    fraseVacio,
    leyendaPlazas,
    notaPlantilla,
    respuestaPartido,
    textoBuscar,
    textoDeben,
} from "@/lib/titulares";
import { Compartir, PieInfo, type PropsInfo } from "./Compartir";
import { aJugadorCampo, bandaEquipo, ListaSinEquipo } from "./jugadores";
import { nombreDe } from "./datos";

const WeatherWidget = dynamic(
    () => import("@/components/WeatherWidget").then((m) => ({ default: m.WeatherWidget })),
    { ssr: false, loading: () => <p className="h-5" /> }
);

function Marca({ estado, children }: { estado: EstadoPeto; children: string }) {
    return (
        <li className="flex items-center gap-1.5">
            <Peto estado={estado} size={16} className="block flex-none" />
            {children}
        </li>
    );
}

export function PartidoEnJuego({
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
    isOrganizer,
    isAdmin,
    apuntandose,
    onVerJugador,
    onOrganizar,
    onApuntarme,
    onBorrarme,
}: PropsInfo & {
    isOrganizer: boolean;
    isAdmin: boolean;
    apuntandose: boolean;
    onApuntarme: () => void;
    onBorrarme: () => void;
}) {
    const abierto = match.status === "open";
    const pasado = new Date(match.date).getTime() < new Date(ahora).getTime();
    const mostrarPagos = abierto;
    const deben = mostrarPagos ? jugadores.filter((p) => !p.has_paid) : [];

    const respuesta = respuestaPartido({
        status: match.status,
        faltan,
        equipo: yo ? equipoDeTeam(yo.team) : null,
        pasado,
    });
    const nota =
        abierto && !pasado && faltan > 0
            ? notaPlantilla(
                  jugadores.map((p) => ({ nombre: p.profiles?.username ?? null, posicion: p.profiles?.position ?? null }))
              )
            : null;

    const { textoSalida } = estadoPortada({
        partido: { ...match, participants: jugadores },
        yo: currentUserId,
        ahora,
    });

    const sePuedeBorrar = abierto && !!yo && !isOrganizer && !isAdmin;
    const sePuedeApuntar = abierto && !yo && faltan > 0;
    const seBusca = abierto && !!yo && faltan > 0 && !pasado;
    const principal = sePuedeApuntar ? "apuntarse" : seBusca ? "buscar" : null;
    const hayBarra = puede.gestiona || sePuedeBorrar || principal !== null;

    const rojo = jugadores.filter((p) => p.team === "A");
    const azul = jugadores.filter((p) => p.team === "B");
    const sinEquipo = jugadores.filter((p) => p.team === null);
    const campo = (p: (typeof jugadores)[number]) => aJugadorCampo(p, currentUserId, mostrarPagos);

    return (
        <div>
            <header className="px-4 pt-3">
                <h1 className="t-seccion text-[32px] leading-none">{fechaCorta(match.date)}</h1>
                <div className="mt-1.5 flex items-baseline justify-between gap-4 text-[15px] leading-tight text-muted">
                    <p className="min-w-0 [overflow-wrap:anywhere]">{match.location}</p>
                    <p className="flex-none tabular-nums">
                        {jugadores.length} de {match.max_players}
                    </p>
                </div>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-3">
                    <p
                        className={cn(
                            "t-titular font-black leading-[0.95]",
                            // «Falta el resultado» no cabe a tamaño «Faltan 3»: una línea antes que dos
                            respuesta.length > 9 ? "text-[min(72px,18.4vw)]" : "text-[min(104px,26.6vw)]"
                        )}
                    >
                        {respuesta}
                    </p>
                    {nota && (
                        <p className="min-w-0 flex-1 basis-16 pb-2 text-right text-[15px] leading-tight text-muted">{nota}</p>
                    )}
                </div>
            </header>

            <section aria-label="Quién va" className={cn("mt-3", !hayEquipos && "px-4")}>
                {hayEquipos ? (
                    <CampoEquipos
                        rojo={rojo.map(campo)}
                        azul={azul.map(campo)}
                        bandaRojo={bandaEquipo(rojo)}
                        bandaAzul={bandaEquipo(azul)}
                        onPulsar={onVerJugador}
                    />
                ) : (
                    <CampoPlantilla
                        jugadores={jugadores.map(campo)}
                        plazas={match.max_players}
                        conLibres={abierto}
                        onPulsar={onVerJugador}
                    />
                )}
            </section>

            {jugadores.length === 0 && (
                <PanenkaDice className="mt-4 px-4">{fraseVacio("apuntados", match.id)}</PanenkaDice>
            )}

            {sinEquipo.length > 0 && hayEquipos && (
                <ListaSinEquipo jugadores={sinEquipo} onVerJugador={onVerJugador} />
            )}

            {mostrarPagos && jugadores.length > 0 && (
                <div className="px-4 pt-3 text-[15px] leading-snug">
                    <ul aria-label="Leyenda de plazas" className="t-meta flex flex-wrap gap-x-4 gap-y-1 text-muted">
                        {pagos > 0 && (
                            <Marca estado="lleno">{leyendaPlazas({ pagados: pagos, deben: 0, libres: 0 })}</Marca>
                        )}
                        {deben.length > 0 && (
                            <Marca estado="debe">{leyendaPlazas({ pagados: 0, deben: deben.length, libres: 0 })}</Marca>
                        )}
                        {faltan > 0 && (
                            <Marca estado="libre">{leyendaPlazas({ pagados: 0, deben: 0, libres: faltan })}</Marca>
                        )}
                    </ul>
                    {deben.length > 0 && (
                        <p className="mt-1.5 font-bold">
                            {textoDeben(deben.map((p) => nombreEnCampo(nombreDe(p))))}
                        </p>
                    )}
                </div>
            )}

            <div className="px-4 pt-3">
                <WeatherWidget date={match.date} />
            </div>

            <Compartir urlPartido={urlPartido} enlaceWhatsApp={enlaceWhatsApp} match={match} className="mt-2" />
            <PieInfo
                match={match}
                seasonName={seasonName}
                organizerName={organizerName}
                organizerAvatarUrl={organizerAvatarUrl}
                organizasTu={isOrganizer}
            />

            {hayBarra && (
                <div className="sticky bottom-[var(--barra-inferior)] z-30 mt-4 border-t border-border bg-background px-4 py-2">
                    {sePuedeBorrar && textoSalida && <p className="t-meta pb-1.5 text-muted">{textoSalida}</p>}
                    <div className="flex gap-2">
                        {puede.gestiona && (
                            <Button
                                type="button"
                                size="lg"
                                variant={principal ? "outline" : "primary"}
                                className={cn(principal ? "flex-none px-4" : "flex-1")}
                                onClick={onOrganizar}
                            >
                                Organizar
                            </Button>
                        )}
                        {sePuedeBorrar && (
                            <Button
                                type="button"
                                size="lg"
                                variant="outline"
                                className={cn(principal ? "flex-none px-4" : "flex-1")}
                                disabled={apuntandose}
                                onClick={onBorrarme}
                            >
                                Me borro
                            </Button>
                        )}
                        {principal === "apuntarse" && (
                            <Button
                                type="button"
                                size="lg"
                                className="min-w-0 flex-1"
                                disabled={apuntandose}
                                onClick={onApuntarme}
                            >
                                Me apunto
                            </Button>
                        )}
                        {principal === "buscar" && (
                            <a
                                href={enlaceWhatsApp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonClasses(
                                    "primary",
                                    "lg",
                                    "min-w-0 flex-1 px-2 text-[clamp(15px,4.4vw,17px)]"
                                )}
                            >
                                {textoBuscar(faltan)}
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
