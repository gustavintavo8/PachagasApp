"use client";

import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { AlertCircle, Minus, Plus } from "lucide-react";
import { createMatch } from "../actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PetoFila } from "@/components/Peto";
import { cn } from "@/lib/utils";
import { diaElegido, diasElegibles, elegidoPasado } from "@/lib/titulares";

const MIN_PLAZAS = 4;
const MAX_PLAZAS = 30;
const DIAS_A_LA_VISTA = 14;
const HORAS = ["18:00", "19:00", "20:00", "21:00", "22:00"];
const HORA_POR_DEFECTO = "20:00";

// Lo que dice createMatch en español. Cualquier otra cosa es un error crudo de la base de datos.
const ERRORES_CONOCIDOS = new Set([
    "No autenticado",
    "Necesitas acceso a la comunidad para continuar",
    "Demasiadas acciones. Espera un momento.",
    "La fecha es obligatoria",
    "La ubicación debe tener al menos 2 caracteres",
    "Mínimo 4 jugadores",
    "Máximo 30 jugadores",
    "No hay una temporada activa disponible",
    "No se pudo preparar la temporada activa",
]);
const ERROR_GENERICO = "No se ha podido crear el partido. Inténtalo otra vez.";

const CASILLA = "pulsable select-none border border-border-hover active:bg-surface-hover";
const CASILLA_ELEGIDA = "border-foreground bg-foreground text-background active:bg-foreground";

function Etiqueta({ htmlFor, children }: { htmlFor: string; children: string }) {
    return (
        <label htmlFor={htmlFor} className="t-seccion block text-[24px]">
            {children}
        </label>
    );
}

interface NewMatchFormProps {
    /** Del servidor, para que los días salgan igual en los dos lados */
    ahora: string;
    sitios: string[];
    fechaInicial: string;
    lugarInicial: string;
    plazasIniciales: number;
}

export function NewMatchForm({ ahora, sitios, fechaInicial, lugarInicial, plazasIniciales }: NewMatchFormProps) {
    // El datetime-local es la verdad; las casillas solo lo rellenan
    const [fecha, setFecha] = useState(fechaInicial);
    const [hora, setHora] = useState(fechaInicial.slice(11, 16) || HORA_POR_DEFECTO);
    const [lugar, setLugar] = useState(lugarInicial);
    const [plazas, setPlazas] = useState(String(plazasIniciales));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const diaActual = fecha.slice(0, 10);
    const dias = diasElegibles(ahora, DIAS_A_LA_VISTA);
    const plazasNumero = Number(plazas);
    const plazasEnRango =
        Number.isInteger(plazasNumero) && plazasNumero >= MIN_PLAZAS && plazasNumero <= MAX_PLAZAS;

    function elegirHora(valor: string) {
        setHora(valor);
        if (diaActual) setFecha(`${diaActual}T${valor}`);
    }

    function cambiarFecha(valor: string) {
        setFecha(valor);
        if (valor) setHora(valor.slice(11, 16));
    }

    function pasoPlazas(paso: number) {
        const base = Number.isFinite(plazasNumero) ? plazasNumero : plazasIniciales;
        setPlazas(String(Math.min(MAX_PLAZAS, Math.max(MIN_PLAZAS, base + paso))));
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        // Convert the local datetime string into a proper UTC ISO string
        const localDate = formData.get("date") as string;
        if (localDate) {
            formData.set("date", new Date(localDate).toISOString());
        }

        try {
            const result = await createMatch(formData);
            if (!result.success) {
                setError(ERRORES_CONOCIDOS.has(result.error) ? result.error : ERROR_GENERICO);
                setLoading(false);
            }
        } catch (fallo) {
            // El redirect de createMatch llega como excepción y tiene que seguir su camino
            unstable_rethrow(fallo);
            setError(ERROR_GENERICO);
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-7 px-4 pb-6 pt-1">
                <div>
                    <h1 className="t-seccion">Nuevo partido</h1>
                    <p aria-live="polite" className="t-titular mt-3">
                        {diaElegido(fecha, ahora) ?? "¿Cuándo?"}
                    </p>
                    {elegidoPasado(fecha, ahora) && (
                        <p className="t-meta mt-2 flex items-center gap-2">
                            <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" className="flex-none text-tarjeta" />
                            Esa hora ya pasó. Se puede, si es para apuntar uno jugado.
                        </p>
                    )}
                </div>

                <section className="space-y-3">
                    <Etiqueta htmlFor="date">Fecha y hora</Etiqueta>

                    <div
                        role="group"
                        aria-label="Día"
                        className="-mx-4 flex snap-x scroll-px-4 gap-1 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none]"
                    >
                        {dias.map(({ valor, etiqueta, dia }) => {
                            const elegido = valor === diaActual;
                            return (
                                <button
                                    key={valor}
                                    type="button"
                                    aria-pressed={elegido}
                                    onClick={() => setFecha(`${valor}T${hora}`)}
                                    className={cn(
                                        "flex h-16 w-[52px] flex-none snap-start flex-col items-center justify-center",
                                        CASILLA,
                                        elegido && CASILLA_ELEGIDA
                                    )}
                                >
                                    <span className="t-meta">{etiqueta}</span>
                                    <span className="t-cifra text-[26px]">{dia}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div role="group" aria-label="Hora" className="grid grid-cols-5 gap-1">
                        {HORAS.map((valor) => {
                            const elegida = valor === hora;
                            return (
                                <button
                                    key={valor}
                                    type="button"
                                    aria-pressed={elegida}
                                    onClick={() => elegirHora(valor)}
                                    className={cn("t-cifra h-12 text-[22px]", CASILLA, elegida && CASILLA_ELEGIDA)}
                                >
                                    {valor}
                                </button>
                            );
                        })}
                    </div>

                    <p className="t-meta text-muted">O cualquier otro día y hora:</p>
                    <input
                        id="date"
                        name="date"
                        type="datetime-local"
                        required
                        value={fecha}
                        onChange={(e) => cambiarFecha(e.target.value)}
                        className="block min-h-12 w-full min-w-0 appearance-none border border-border-hover bg-surface px-3 py-2 text-base text-foreground [color-scheme:dark] focus:border-foreground focus:outline-none"
                    />
                </section>

                <section className="space-y-3">
                    <Etiqueta htmlFor="location">Ubicación</Etiqueta>
                    {sitios.length > 0 && (
                        <div role="group" aria-label="Sitios de siempre" className="space-y-1">
                            {sitios.map((sitio) => {
                                const elegido = sitio === lugar.trim();
                                return (
                                    <button
                                        key={sitio}
                                        type="button"
                                        aria-pressed={elegido}
                                        onClick={() => setLugar(sitio)}
                                        className={cn(
                                            "block min-h-12 w-full truncate px-4 text-left font-medium",
                                            CASILLA,
                                            elegido && CASILLA_ELEGIDA
                                        )}
                                    >
                                        {sitio}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <Input
                        id="location"
                        name="location"
                        placeholder="ej. Campo Municipal, Pista 3"
                        value={lugar}
                        onChange={(e) => setLugar(e.target.value)}
                        required
                        minLength={2}
                        autoComplete="off"
                        autoCapitalize="sentences"
                        enterKeyHint="done"
                    />
                </section>

                <section className="space-y-3">
                    <Etiqueta htmlFor="max_players">Plazas</Etiqueta>
                    <div className="flex items-center justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            aria-label="Una plaza menos"
                            disabled={plazasEnRango && plazasNumero <= MIN_PLAZAS}
                            onClick={() => pasoPlazas(-1)}
                            className="size-14 flex-none !px-0"
                        >
                            <Minus size={22} strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                        <input
                            id="max_players"
                            name="max_players"
                            type="number"
                            inputMode="numeric"
                            enterKeyHint="done"
                            min={MIN_PLAZAS}
                            max={MAX_PLAZAS}
                            step={1}
                            required
                            value={plazas}
                            onChange={(e) => setPlazas(e.target.value)}
                            className="t-cifra h-14 w-full min-w-0 appearance-none bg-transparent text-center text-[56px] text-foreground [-moz-appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            aria-label="Una plaza más"
                            disabled={plazasEnRango && plazasNumero >= MAX_PLAZAS}
                            onClick={() => pasoPlazas(1)}
                            className="size-14 flex-none !px-0"
                        >
                            <Plus size={22} strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                    </div>
                    {plazasEnRango && (
                        <div style={{ maxWidth: (plazasNumero > 14 ? Math.ceil(plazasNumero / 2) : plazasNumero) * 26 }}>
                            <PetoFila ocupadas={1} plazas={plazasNumero} />
                        </div>
                    )}
                    <p className="t-meta text-muted">Entre 4 y 30. Te apuntas tú al crearlo.</p>
                </section>
            </div>

            <div className="sticky bottom-[var(--barra-inferior)] z-10 border-t border-border bg-background px-4 py-3">
                {error && (
                    <p role="alert" className="mb-3 flex items-start gap-2 text-[15px] font-medium leading-snug">
                        <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" className="mt-px flex-none text-tarjeta" />
                        {error}
                    </p>
                )}
                <Button type="submit" loading={loading} size="lg" className="w-full">
                    Crear partido
                </Button>
            </div>
        </form>
    );
}
