"use client";

import Link from "next/link";
import { useLayoutEffect, useOptimistic, useRef, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { joinMatch, leaveMatch } from "@/app/matches/actions";
import { Flood } from "@/components/Flood";
import { Panenka } from "@/components/Panenka";
import { PetoFila } from "@/components/Peto";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
    PORTADA_SIN_DATOS,
    charsRespuesta,
    diaYMes,
    equipoDeTeam,
    estadoPortada,
    fraseVacio,
    preguntaPortada,
    textoConEquipo,
    textoFaltan,
    textoSinDecirNada,
    type PartidoPortada,
} from "@/lib/titulares";

export type PlazaPortada = PartidoPortada["participants"][number] & { nombre: string | null };
export type PartidoInicio = Omit<PartidoPortada, "participants"> & { participants: PlazaPortada[] };

type Movimiento = "entra" | "sale";

const SIN_DECIR_NADA_TOPE = 6;

// El marco de la portada ocupa lo que dejan las barras, para que la acción quede bajo el pulgar.
const MARCO = "flex min-h-[calc(100dvh-var(--barra-superior)-var(--barra-inferior))] flex-col";

function Respuesta({ texto }: { texto: string }) {
    return (
        <h1 className="t-respuesta -ml-0.5 mt-1" style={{ "--chars": charsRespuesta(texto) } as CSSProperties}>
            {texto}
        </h1>
    );
}

function Cabecera({ pregunta, puesto }: { pregunta: string; puesto?: ReactNode }) {
    return (
        <div className="flex min-h-11 items-center justify-between gap-3">
            <p className="text-[length:min(18px,5vw)] leading-tight text-muted">{pregunta}</p>
            {puesto}
        </div>
    );
}

/** Dos telones negros que se abren desde la costura, solo la primera vez que ves tu peto en ese partido. */
function Telon({ partidoId, equipo }: { partidoId: string; equipo: string }) {
    const telon = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const clave = `peto-visto:${partidoId}:${equipo}`;
        try {
            if (localStorage.getItem(clave)) return;
            localStorage.setItem(clave, "1");
        } catch {
            return;
        }
        telon.current?.removeAttribute("hidden");
    }, [partidoId, equipo]);

    return (
        <div ref={telon} hidden aria-hidden className="pointer-events-none fixed inset-0 z-30 motion-reduce:hidden">
            <div className="absolute inset-y-0 left-0 w-1/2 animate-[marcador-abre-azul_220ms_var(--ease-out)_reverse_both] bg-black" />
            <div className="absolute inset-y-0 right-0 w-1/2 animate-[marcador-abre-rojo_220ms_var(--ease-out)_reverse_both] bg-black" />
        </div>
    );
}

export function InicioPortada({
    partido,
    yo,
    miNombre,
    ahora,
    puedeBorrarse,
    candidatos,
    puesto,
    banda,
}: {
    partido: PartidoInicio | null;
    yo: string;
    miNombre: string | null;
    /** Del servidor: el mismo instante en los dos lados, para no romper la hidratación. */
    ahora: string;
    /** Mismas reglas que el detalle del partido: abierto, y ni organizador ni admin. */
    puedeBorrarse: boolean;
    /** Quienes han jugado esta temporada, los que más juegan primero. */
    candidatos: { id: string; nombre: string }[];
    puesto: ReactNode;
    banda: ReactNode;
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [pendiente, startTransition] = useTransition();
    const [plazas, moverPlaza] = useOptimistic(
        partido?.participants ?? [],
        (actuales, movimiento: Movimiento): PlazaPortada[] =>
            movimiento === "entra"
                ? [...actuales, { user_id: yo, team: null, nombre: miNombre }]
                : actuales.filter((plaza) => plaza.user_id !== yo)
    );

    const estado = estadoPortada({ partido: partido && { ...partido, participants: plazas }, yo, ahora });
    const pregunta = preguntaPortada(partido?.date, ahora);

    function mover(movimiento: Movimiento) {
        if (!partido || pendiente) return;
        const partidoId = partido.id;
        navigator.vibrate?.(8);
        startTransition(async () => {
            moverPlaza(movimiento);
            const resultado = await (movimiento === "entra" ? joinMatch(partidoId) : leaveMatch(partidoId));
            if (!resultado.success) {
                toast(resultado.error, "error");
                // Lo normal es que el partido haya cambiado: mejor enseñar cómo está ahora
                router.refresh();
            }
        });
    }

    if (estado.estado === "sin-partido" || !partido) {
        return (
            <div className={MARCO}>
                <div className="flex-1 pb-6">
                    <div className="px-4 pt-1">
                        <Cabecera pregunta={pregunta} puesto={puesto} />
                        <Respuesta texto={estado.respuesta} />
                        <p className="mt-4 text-lg font-medium leading-snug">
                            {fraseVacio("sin-partido", diaYMes(ahora))}
                        </p>
                        {!banda && <Panenka mood="dormido" size={120} className="mt-6" />}
                    </div>
                    {banda}
                </div>
                <BarraAccion>
                    <Link href="/matches/new" className={buttonClasses("primary", "lg", "w-full")}>
                        Montar partido
                    </Link>
                </BarraAccion>
            </div>
        );
    }

    const enlacePartido = `/matches/${partido.id}`;
    const sigoDentro = estado.estado === "apuntado" || estado.estado === "con-equipo";
    const cerrado = partido.status === "closed";
    const conEquipos = plazas.some((plaza) => plaza.team !== null);

    const faltanTexto = cerrado ? "Cerrado" : textoFaltan(estado.faltan);
    const callados = candidatos
        .filter((c) => c.id !== yo && !plazas.some((plaza) => plaza.user_id === c.id))
        .map((c) => c.nombre);
    const sinDecirNada = !cerrado && estado.faltan > 0 ? textoSinDecirNada(callados, SIN_DECIR_NADA_TOPE) : null;

    const anuncio = `${estado.respuesta} ${faltanTexto}`;

    if (estado.estado === "con-equipo") {
        const nombres = (equipo: typeof estado.equipo) =>
            plazas
                .filter((plaza) => plaza.user_id !== yo && equipoDeTeam(plaza.team) === equipo)
                .map((plaza) => plaza.nombre ?? "Sin nombre")
                .sort((a, b) => a.localeCompare(b, "es"));
        const texto = textoConEquipo({
            equipo: estado.equipo,
            companeros: nombres(estado.equipo),
            rivales: nombres(estado.equipo === "rojo" ? "azul" : "rojo"),
        });

        return (
            <div className={MARCO}>
                <Flood color={estado.equipo} />
                <Telon partidoId={partido.id} equipo={estado.equipo} />
                <p aria-live="polite" className="sr-only">{anuncio}</p>
                <div className="flex-1 px-4 pb-6 pt-1">
                    <Cabecera pregunta={pregunta} puesto={puesto} />
                    <Respuesta texto={estado.respuesta} />
                    <p className="mt-3.5 text-lg font-medium leading-snug">{estado.linea}</p>
                    <p className="t-titular mt-7">{texto.con}</p>
                    {texto.resto && <p className="mt-3 text-[17px] font-medium leading-snug">{texto.resto}</p>}
                    {texto.enfrente && <p className="mt-3 text-[17px] font-medium leading-snug">{texto.enfrente}</p>}
                    {!cerrado && estado.faltan > 0 && <p className="t-seccion mt-5">{faltanTexto}</p>}
                </div>
                <BarraAccion
                    color={estado.equipo}
                    salida={puedeBorrarse ? estado.textoSalida : null}
                    acompanante={
                        puedeBorrarse ? (
                            <Button variant="outline" size="sm" type="button" onClick={() => mover("sale")}>
                                Me borro
                            </Button>
                        ) : undefined
                    }
                >
                    <Link href={enlacePartido} prefetch={false} className={buttonClasses("primary", "lg", "w-full")}>
                        Ver equipos
                    </Link>
                </BarraAccion>
            </div>
        );
    }

    const verPartido = (
        <Link href={enlacePartido} prefetch={false} className="pulsable t-meta flex min-h-11 items-center pl-3 text-muted underline-offset-4 hover:underline">
            Ver partido
        </Link>
    );

    return (
        <div className={MARCO}>
            <p aria-live="polite" className="sr-only">{anuncio}</p>
            <div className="flex-1 pb-6">
                <div className="px-4 pt-1">
                    <Cabecera pregunta={pregunta} puesto={puesto} />
                    <Respuesta texto={estado.respuesta} />
                    <p className="mt-3.5 text-lg font-medium leading-snug">{estado.linea}</p>

                    <div className="mt-5 flex items-baseline justify-between gap-3">
                        <p className="t-titular whitespace-nowrap text-[length:min(80px,20vw)]">{faltanTexto}</p>
                        {!conEquipos && <p className="t-meta text-right text-muted">Sin equipos todavía</p>}
                    </div>
                    <PetoFila className="mt-2.5" ocupadas={plazas.length} plazas={partido.max_players} />
                    {sinDecirNada && <p className="mt-3 text-[15px] leading-snug">{sinDecirNada}</p>}
                </div>
                {banda}
            </div>

            {estado.estado === "libre" && (
                <BarraAccion acompanante={verPartido}>
                    <Button size="lg" type="button" className="w-full" onClick={() => mover("entra")}>
                        Me apunto
                    </Button>
                </BarraAccion>
            )}
            {estado.estado === "lleno" && (
                <BarraAccion>
                    <Link href={enlacePartido} prefetch={false} className={buttonClasses("primary", "lg", "w-full")}>
                        Ver quién va
                    </Link>
                </BarraAccion>
            )}
            {sigoDentro && puedeBorrarse && (
                <BarraAccion salida={estado.textoSalida} acompanante={verPartido}>
                    <Button variant="outline" size="lg" type="button" className="w-full" onClick={() => mover("sale")}>
                        Me borro
                    </Button>
                </BarraAccion>
            )}
            {sigoDentro && !puedeBorrarse && (
                <BarraAccion>
                    <Link href={enlacePartido} prefetch={false} className={buttonClasses("outline", "lg", "w-full")}>
                        Ver partido
                    </Link>
                </BarraAccion>
            )}
        </div>
    );
}

/** Se queda pegada sobre la barra inferior mientras la portada no quepa, y luego se va con ella. */
function BarraAccion({
    children,
    salida,
    acompanante,
    color,
}: {
    children: ReactNode;
    salida?: string | null;
    acompanante?: ReactNode;
    color?: "rojo" | "azul";
}) {
    const fondo = color === "rojo" ? "bg-rojo" : color === "azul" ? "bg-azul" : "bg-background";
    return (
        <div className={cn("sticky bottom-[var(--barra-inferior)] z-10 px-4 pb-3", fondo, !acompanante && !salida && "pt-3")}>
            {(salida || acompanante) && (
                <div className="mb-1.5 flex min-h-11 items-center justify-between gap-3">
                    <p className="t-meta">{salida}</p>
                    {acompanante}
                </div>
            )}
            {children}
        </div>
    );
}

export function PortadaSinDatos({ pregunta }: { pregunta: string }) {
    const router = useRouter();
    const [recargando, startTransition] = useTransition();

    return (
        <div className={MARCO}>
            <div className="flex-1 px-4 pb-6 pt-1">
                <Cabecera pregunta={pregunta} />
                <Respuesta texto={PORTADA_SIN_DATOS.respuesta} />
                <p className="mt-3.5 flex items-start gap-2 text-lg font-medium leading-snug">
                    <AlertTriangle size={18} strokeWidth={1.75} aria-hidden className="mt-1 flex-none text-tarjeta" />
                    {PORTADA_SIN_DATOS.linea}
                </p>
            </div>
            <BarraAccion>
                <Button
                    variant="outline"
                    size="lg"
                    type="button"
                    className="w-full"
                    loading={recargando}
                    onClick={() => startTransition(() => router.refresh())}
                >
                    Reintentar
                </Button>
            </BarraAccion>
        </div>
    );
}
