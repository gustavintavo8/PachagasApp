"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Copy, MessageCircle } from "lucide-react";
import { AddToCalendar } from "@/components/AddToCalendar";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn, getAvatarUrl } from "@/lib/utils";
import { estadoPartido } from "@/lib/titulares";
import type { Match } from "@/lib/types";
import type { Participante, Permisos } from "./datos";

export const WeatherWidget = dynamic(
    () => import("@/components/WeatherWidget").then((m) => ({ default: m.WeatherWidget })),
    { ssr: false, loading: () => <p className="h-5" /> }
);

/** Lo que reciben las tres pantallas de Info. */
export type PropsInfo = {
    match: Match;
    jugadores: Participante[];
    yo: Participante | undefined;
    faltan: number;
    pagos: number;
    hayEquipos: boolean;
    puede: Permisos;
    currentUserId: string;
    organizerName: string;
    organizerAvatarUrl: string | null;
    seasonName: string;
    urlPartido: string;
    enlaceWhatsApp: string;
    ahora: string;
    onVerJugador: (id: string) => void;
    onOrganizar: () => void;
};

// navigator.clipboard solo existe en https: en local o en webviews antiguas hace falta el plan B
async function copiar(texto: string): Promise<boolean> {
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch {
        // Permiso denegado: se sigue con el plan B
    }

    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const hecho = document.execCommand("copy");
    campo.remove();
    return hecho;
}

const ENLACE = "pulsable inline-flex min-h-11 select-none items-center gap-1.5 text-[15px] font-medium active:text-muted";

export function Compartir({
    urlPartido,
    enlaceWhatsApp,
    match,
    className,
}: {
    urlPartido: string;
    enlaceWhatsApp: string;
    match: Match;
    className?: string;
}) {
    const { toast } = useToast();

    async function copiarEnlace() {
        const hecho = await copiar(urlPartido);
        if (hecho) toast("Enlace copiado", "success");
        else toast("No se ha podido copiar el enlace", "error");
    }

    return (
        <div className={cn("flex flex-wrap items-center gap-x-5 px-4", className)}>
            <button type="button" onClick={copiarEnlace} className={ENLACE}>
                <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
                Copiar enlace
            </button>
            <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                <MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
                WhatsApp
            </a>
            {/* En escritorio, a la derecha: su menú se abre hacia la izquierda */}
            <div className="md:ml-auto">
                <AddToCalendar match={match} />
            </div>
        </div>
    );
}

/** Lo que no es la respuesta: estado, temporada, quién organiza y si tú mandas aquí. */
export function PieInfo({
    match,
    seasonName,
    organizerName,
    organizerAvatarUrl,
    organizasTu,
    eresAdmin,
}: {
    match: Match;
    seasonName: string;
    organizerName: string;
    organizerAvatarUrl: string | null;
    organizasTu: boolean;
    eresAdmin: boolean;
}) {
    return (
        <div className="t-meta flex flex-wrap items-center justify-between gap-x-4 px-4 text-muted">
            <p className="py-3">
                {estadoPartido(match.status)} · {seasonName}
                {eresAdmin && " · Eres admin"}
            </p>
            <Link
                href={`/players/${match.created_by}`}
                className="pulsable flex min-h-11 select-none items-center gap-2 active:text-foreground"
            >
                <Avatar
                    src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, organizerAvatarUrl)}
                    fallback={organizerName}
                    size="sm"
                    className="h-6 w-6 text-sm"
                />
                {organizasTu ? "Organizas tú" : `Organiza ${organizerName}`}
            </Link>
        </div>
    );
}
