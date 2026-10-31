import type { Match, MatchParticipant, Profile } from "@/lib/types";

export type Participante = MatchParticipant & { profiles: Profile };

export type PestanaPartido = "info" | "chat" | "fotos";

export type HojaPartido = "organizar" | "resultado" | "fecha" | "cancelar" | "cobros";

/** Lo que cambia antes de que conteste el servidor. Si la acción falla, React lo deshace solo. */
export type CambioOptimista =
    | { tipo: "entra"; jugador: Participante }
    | { tipo: "sale"; id: string }
    | { tipo: "pago"; id: string; pagado: boolean };

export function aplicarCambio(lista: Participante[], cambio: CambioOptimista): Participante[] {
    if (cambio.tipo === "entra") return [...lista, cambio.jugador];
    if (cambio.tipo === "sale") return lista.filter((p) => p.user_id !== cambio.id);
    return lista.map((p) => (p.user_id === cambio.id ? { ...p, has_paid: cambio.pagado } : p));
}

/** Crear un partido con el mismo sitio y las mismas plazas. */
export function enlaceRepetir(match: Pick<Match, "location" | "max_players">): string {
    return `/matches/new?location=${encodeURIComponent(match.location)}&max_players=${match.max_players}`;
}

export function nombreDe(p: Participante): string {
    return p.profiles?.username || "Anónimo";
}

/** Quién puede hacer qué. Las mismas reglas que las actions: la interfaz solo las refleja. */
export function permisos(match: Match, yo: string, esAdmin: boolean) {
    const organiza = match.created_by === yo;
    const gestiona = esAdmin || organiza;
    const vivo = match.status === "open" || match.status === "closed";
    return {
        organiza,
        gestiona,
        generar: gestiona && match.status === "open",
        resultado: gestiona && vivo,
        fecha: gestiona && vivo,
        cancelar: gestiona && vivo,
        cobros: gestiona && match.status === "open",
        repetir: gestiona && match.status === "finished",
        expulsar: esAdmin && match.status === "open",
    };
}

export type Permisos = ReturnType<typeof permisos>;
