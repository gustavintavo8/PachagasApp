"use client";

import { PanenkaDice } from "@/components/PanenkaDice";
import { fechaCorta, fraseCancelado, respuestaPartido } from "@/lib/titulares";
import { Compartir, PieInfo, WeatherWidget, type PropsInfo } from "./Compartir";
import { ListaJugadores } from "./jugadores";

export function PartidoCancelado({
    match,
    jugadores,
    faltan,
    puede,
    organizerName,
    organizerAvatarUrl,
    seasonName,
    urlPartido,
    enlaceWhatsApp,
    onVerJugador,
}: PropsInfo) {
    return (
        <div>
            <header className="px-4 pt-3">
                <div className="flex items-center gap-3">
                    <h1 className="t-titular text-[min(88px,22vw)] font-black leading-[0.95]">
                        {respuestaPartido({ status: match.status, faltan })}
                    </h1>
                    {/* La tarjeta: lo único en color de toda la pantalla */}
                    <span aria-hidden="true" className="h-[44px] w-[32px] flex-none rotate-[9deg] bg-tarjeta" />
                </div>
                <p className="t-seccion mt-3 text-[32px] leading-none">{fechaCorta(match.date)}</p>
                <p className="mt-1.5 text-[15px] leading-tight text-muted [overflow-wrap:anywhere]">
                    {match.location}
                </p>
            </header>

            <PanenkaDice className="mt-6 px-4">{fraseCancelado(match.id)}</PanenkaDice>

            <div className="px-4 pt-3">
                <WeatherWidget date={match.date} />
            </div>

            {jugadores.length > 0 && (
                <ListaJugadores titulo="Se habían apuntado" jugadores={jugadores} onVerJugador={onVerJugador} />
            )}

            <Compartir urlPartido={urlPartido} enlaceWhatsApp={enlaceWhatsApp} match={match} className="mt-4" />
            <PieInfo
                match={match}
                seasonName={seasonName}
                organizerName={organizerName}
                organizerAvatarUrl={organizerAvatarUrl}
                organizasTu={puede.organiza}
                eresAdmin={puede.gestiona && !puede.organiza}
            />
        </div>
    );
}
