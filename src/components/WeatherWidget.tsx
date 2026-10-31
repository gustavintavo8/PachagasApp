"use client";

import { useEffect, useState } from "react";
import {
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSnow,
    CloudSun,
    Sun,
    type LucideIcon,
} from "lucide-react";
import { cieloDeCodigo, diaIsoMadrid, diasHasta, lineaTiempo, type Cielo } from "@/lib/titulares";

const DIAS_DE_PREVISION = 16;
const ESPERA_MAXIMA_MS = 5000;

const ICONOS: Record<Cielo, LucideIcon> = {
    despejado: Sun,
    "algo-nuboso": CloudSun,
    nublado: Cloud,
    niebla: CloudFog,
    llovizna: CloudDrizzle,
    lluvia: CloudRain,
    nieve: CloudSnow,
    tormenta: CloudLightning,
};

type Prevision = { texto: string; cielo: Cielo | null };

// Volver a la pestaña no repite la petición ni el hueco
const previsiones = new Map<string, Prevision | null>();

async function pedirPrevision(dia: string, signal: AbortSignal): Promise<Prevision | null> {
    // Mieres, Asturias
    const respuesta = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=43.25&longitude=-5.7667&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=Europe%2FMadrid&forecast_days=${DIAS_DE_PREVISION}`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(ESPERA_MAXIMA_MS)]) }
    );
    if (!respuesta.ok) return null;

    const { daily } = await respuesta.json();
    const indice = daily?.time?.indexOf(dia) ?? -1;
    if (indice === -1) return null;

    const cielo = cieloDeCodigo(daily.weathercode?.[indice]);
    const texto = lineaTiempo({
        cielo,
        temperatura: daily.temperature_2m_max?.[indice],
        probabilidadLluvia: daily.precipitation_probability_max?.[indice],
    });
    return texto ? { texto, cielo } : null;
}

export function WeatherWidget({ date }: { date: string }) {
    const dia = diaIsoMadrid(date);
    // Se lee una vez: fuera de la ventana de previsión no hay nada que pedir ni que reservar
    const [enVentana] = useState(() => {
        const dias = diasHasta(date, Date.now());
        return dias >= 0 && dias < DIAS_DE_PREVISION;
    });
    const [recibida, setRecibida] = useState<{ dia: string; prevision: Prevision | null } | null>(null);

    useEffect(() => {
        if (!enVentana || previsiones.has(dia)) return;

        const peticion = new AbortController();
        pedirPrevision(dia, peticion.signal)
            .then((prevision) => {
                previsiones.set(dia, prevision);
                setRecibida({ dia, prevision });
            })
            .catch(() => {
                if (!peticion.signal.aborted) setRecibida({ dia, prevision: null });
            });

        return () => peticion.abort();
    }, [dia, enVentana]);

    if (!enVentana) return null;

    const prevision = previsiones.get(dia) ?? (recibida?.dia === dia ? recibida.prevision : null);
    const Icono = prevision?.cielo ? ICONOS[prevision.cielo] : null;

    // La línea mide lo mismo cargando, con dato y sin él: la página no salta. Mientras llega, nada:
    // un bloque gris sobre «Copiar enlace» parecía un fallo, y el tiempo no es lo importante aquí.
    return (
        <p className="t-meta flex h-5 items-center gap-1.5 tabular-nums text-muted">
            {Icono && <Icono size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />}
            {prevision && <span>{prevision.texto}</span>}
        </p>
    );
}
