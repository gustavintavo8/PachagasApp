"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Fila, Filas } from "@/components/Filas";
import { PanenkaDice } from "@/components/PanenkaDice";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { fraseVacio, plural } from "@/lib/titulares";
import { cn, getAvatarUrl } from "@/lib/utils";
import { POSICION, type FilaRanking } from "@/app/leaderboard/tabla";

const POSICIONES = [
    { clave: "ALL", etiqueta: "Todos" },
    { clave: "GK", etiqueta: "Porteros" },
    { clave: "DEF", etiqueta: "Defensas" },
    { clave: "MID", etiqueta: "Medios" },
    { clave: "FWD", etiqueta: "Delanteros" },
] as const;

type Posicion = (typeof POSICIONES)[number]["clave"];

function posicionDeUrl(valor: string | null): Posicion {
    return POSICIONES.find(({ clave }) => clave === valor)?.clave ?? "ALL";
}

/** Sin mayúsculas ni tildes: «ruben» encuentra a Rubén. */
function normalizar(texto: string): string {
    return texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

export function PlayersList({
    jugadores,
    yo,
    adminUserIds,
    semilla,
}: {
    jugadores: FilaRanking[];
    yo: string;
    adminUserIds: string[];
    semilla: string;
}) {
    const parametros = useSearchParams();
    const [busqueda, setBusqueda] = useState(parametros.get("q") ?? "");
    const [posicion, setPosicion] = useState<Posicion>(posicionDeUrl(parametros.get("pos")));
    const entrada = useRef<HTMLInputElement>(null);

    // En la URL, para volver de un jugador con la lista como estaba
    useEffect(() => {
        const url = new URL(window.location.href);
        if (busqueda) url.searchParams.set("q", busqueda);
        else url.searchParams.delete("q");
        if (posicion !== "ALL") url.searchParams.set("pos", posicion);
        else url.searchParams.delete("pos");
        if (url.href !== window.location.href) window.history.replaceState(null, "", url);
    }, [busqueda, posicion]);

    const texto = normalizar(busqueda.trim());
    const visibles = jugadores.filter(
        (jugador) =>
            (!texto || normalizar(jugador.username ?? "").includes(texto)) &&
            (posicion === "ALL" || jugador.position === posicion)
    );

    const filtrando = texto !== "" || posicion !== "ALL";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    function limpiar() {
        setBusqueda("");
        setPosicion("ALL");
    }

    return (
        <div className="mt-4">
            <div className="px-4">
                <div className="relative">
                    <Search
                        size={18}
                        strokeWidth={1.75}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                    />
                    <input
                        ref={entrada}
                        type="search"
                        inputMode="search"
                        enterKeyHint="search"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-label="Buscar jugadores"
                        placeholder="Buscar jugadores..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="h-[52px] w-full appearance-none border border-transparent bg-surface pr-12 pl-10 text-base text-foreground outline-none placeholder:text-muted focus:border-foreground [&::-webkit-search-cancel-button]:hidden"
                    />
                    {busqueda && (
                        <button
                            type="button"
                            aria-label="Borrar la búsqueda"
                            onClick={() => {
                                setBusqueda("");
                                // El botón desaparece: sin esto el teclado se cierra
                                entrada.current?.focus();
                            }}
                            className="absolute top-0 right-0 flex h-[52px] w-12 items-center justify-center text-muted"
                        >
                            <X size={18} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            <div
                role="group"
                aria-label="Filtrar por posición"
                className="sticky top-0 z-10 mt-2 flex justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]"
            >
                {POSICIONES.map(({ clave, etiqueta }) => {
                    const activo = clave === posicion;
                    return (
                        <button
                            key={clave}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => setPosicion(clave)}
                            className={cn(
                                "min-h-12 min-w-11 font-display text-[length:min(22px,5.3vw)] leading-none",
                                activo
                                    ? "font-extrabold text-foreground underline decoration-2 underline-offset-[6px]"
                                    : "font-semibold text-muted"
                            )}
                        >
                            {etiqueta}
                        </button>
                    );
                })}
            </div>

            <p role="status" className="t-meta px-4 pt-4 pb-2 text-muted">
                {plural(visibles.length, "jugador")}
            </p>

            {visibles.length > 0 ? (
                <Filas aria-label="Jugadores">
                    {visibles.map((jugador) => {
                        const nombre = jugador.username || "Desconocido";
                        const tu = jugador.id === yo;
                        const detalle = [
                            jugador.position && POSICION[jugador.position],
                            `${jugador.matches_played} PJ`,
                            plural(jugador.goals_scored, "gol"),
                        ]
                            .filter(Boolean)
                            .join(" · ");

                        return (
                            <Fila
                                key={jugador.id}
                                href={`/players/${jugador.id}`}
                                tu={tu}
                                aria-current={tu ? "true" : undefined}
                                inicio={
                                    <Avatar
                                        src={getAvatarUrl(supabaseUrl, jugador.avatar_url)}
                                        fallback={nombre}
                                        size="md"
                                    />
                                }
                                nombre={
                                    <>
                                        {tu ? `${nombre}, tú` : nombre}
                                        {adminUserIds.includes(jugador.id) && (
                                            <span className="t-meta ml-2 font-medium">Admin</span>
                                        )}
                                    </>
                                }
                                detalle={detalle}
                                cifra={
                                    <>
                                        {jugador.elo_rating}
                                        <span className="sr-only"> RP</span>
                                    </>
                                }
                            />
                        );
                    })}
                </Filas>
            ) : (
                <div className="px-4 pt-4">
                    <PanenkaDice>{fraseVacio("jugadores", filtrando ? texto + posicion : semilla)}</PanenkaDice>
                    {filtrando && (
                        <button
                            type="button"
                            onClick={limpiar}
                            className={buttonClasses("outline", "lg", "mt-6 w-full")}
                        >
                            Ver a todos
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
