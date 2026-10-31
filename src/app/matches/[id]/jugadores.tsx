import { Avatar } from "@/components/ui/Avatar";
import { Fila, Filas } from "@/components/Filas";
import type { JugadorCampo } from "@/components/Campo";
import { getAvatarUrl } from "@/lib/utils";
import { elegirPlural } from "@/lib/titulares";
import { nombreDe, type Participante } from "./datos";

export function aJugadorCampo(p: Participante, yo: string, conPagos: boolean): JugadorCampo {
    return {
        id: p.user_id,
        nombre: nombreDe(p),
        posicion: p.profiles?.position ?? null,
        estado: conPagos && !p.has_paid ? "debe" : "lleno",
        tu: p.user_id === yo,
        mvp: p.is_mvp,
    };
}

/** "1043 RP de media · 7 jugadores". Vacío si el equipo no tiene a nadie. */
export function bandaEquipo(equipo: Participante[]): string {
    if (equipo.length === 0) return "Sin jugadores";
    const suma = equipo.reduce((total, p) => total + (p.profiles?.elo_rating ?? 1000), 0);
    const media = Math.round(suma / equipo.length);
    return `${media} RP de media · ${equipo.length} ${elegirPlural(equipo.length, "jugador")}`;
}

export function AvatarJugador({ jugador }: { jugador: Participante }) {
    return (
        <Avatar
            src={getAvatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, jugador.profiles?.avatar_url ?? null)}
            fallback={jugador.profiles?.username || "P"}
            size="sm"
        />
    );
}

/** Lista corta de nombres: quien entró con los equipos ya hechos, o los que iban a un partido cancelado. */
export function ListaJugadores({
    jugadores,
    titulo,
    onVerJugador,
}: {
    jugadores: Participante[];
    titulo: string;
    onVerJugador: (id: string) => void;
}) {
    return (
        <section className="mt-6">
            <h2 className="t-seccion px-4 pb-2">
                {titulo} <span className="tabular-nums text-muted">{jugadores.length}</span>
            </h2>
            <Filas aria-label={titulo}>
                {jugadores.map((p) => (
                    <Fila
                        key={p.user_id}
                        inicio={<AvatarJugador jugador={p} />}
                        nombre={nombreDe(p)}
                        onClick={() => onVerJugador(p.user_id)}
                    />
                ))}
            </Filas>
        </section>
    );
}

export function ListaSinEquipo(props: { jugadores: Participante[]; onVerJugador: (id: string) => void }) {
    return <ListaJugadores {...props} titulo="Sin equipo" />;
}
