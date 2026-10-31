export type EstadoPeto = "lleno" | "debe" | "libre";
type Equipo = "rojo" | "azul";

// Silueta con sisa marcada: a 16px tiene que seguir leyéndose como peto y no como camiseta.
const CUERPO = "M5.4 1H8.6L11 5.8L13.4 1H16.6L17.4 6.6L20.4 10.2V25H1.6V10.2L4.6 6.6Z";
// CUERPO desplazado 2,3 hacia fuera. Se sale de la caja a propósito.
const CONTORNO_TU = "M3.4 -1.3L10 -1.3L11 .7L12 -1.3L18.6 -1.3L19.6 5.6L22.7 9.4V27.3H-.7V9.4L2.4 5.6Z";

const COLOR: Record<Equipo, string> = {
    rojo: "var(--color-rojo, #d8141e)",
    azul: "var(--color-azul, #0a55d8)",
};

export function Peto({
    estado,
    equipo = null,
    tu = false,
    apagado = false,
    size = 22,
    className,
    title,
}: {
    estado: EstadoPeto;
    equipo?: Equipo | null;
    tu?: boolean;
    /** Cede el protagonismo a los libres de la fila. No afecta a los petos de equipo. */
    apagado?: boolean;
    size?: number;
    className?: string;
    title?: string;
}) {
    const libre = estado === "libre";
    // Libre va siempre a tinta completa: es lo que se tiene que ver en la fila
    const color = libre ? "currentColor" : equipo ? COLOR[equipo] : apagado ? "var(--muted, #a8a8a8)" : "currentColor";

    return (
        <svg
            width={size}
            height={(size * 26) / 22}
            viewBox="0 0 22 26"
            overflow="visible"
            className={className}
            role={title ? "img" : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
            focusable="false"
        >
            {title && <title>{title}</title>}
            {/* Mismo trazado en los tres estados para que el libre se llene en su sitio */}
            <path
                className="peto-cuerpo"
                d={CUERPO}
                fill={color}
                fillOpacity={libre ? 0 : 1}
                stroke={color}
                strokeOpacity={libre ? 1 : 0}
                strokeWidth={2.2}
                pathLength={12}
                strokeDasharray=".6 .4"
            />
            {tu && <path d={CONTORNO_TU} fill="none" stroke="currentColor" strokeWidth={1.3} />}
            {estado === "debe" && (
                <rect
                    x={13}
                    y={12}
                    width={8.5}
                    height={11.5}
                    transform="rotate(9 17 18)"
                    fill="var(--color-tarjeta, #ffcf0d)"
                    stroke="#000"
                    strokeWidth={1.2}
                />
            )}
        </svg>
    );
}

export function PetoFila({
    ocupadas,
    plazas,
    pagadas,
    equipo = null,
    className,
}: {
    ocupadas: number;
    plazas: number;
    pagadas?: number;
    equipo?: Equipo | null;
    className?: string;
}) {
    const dentro = Math.min(ocupadas, plazas);
    const alDia = pagadas === undefined ? dentro : Math.min(pagadas, dentro);
    // Hasta 14 caben en una fila incluso a 320px; de ahí en adelante, dos
    const columnas = plazas > 14 ? Math.ceil(plazas / 2) : plazas;
    // Mientras falte gente, lo que más se ve son los huecos
    const apagado = dentro < plazas;

    return (
        <div
            role="img"
            aria-label={`${ocupadas} de ${plazas} plazas`}
            className={["grid justify-between gap-x-1 gap-y-2", className].filter(Boolean).join(" ")}
            style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 28px))` }}
        >
            {Array.from({ length: plazas }, (_, i) => (
                <Peto
                    key={i}
                    estado={i < alDia ? "lleno" : i < dentro ? "debe" : "libre"}
                    equipo={equipo}
                    apagado={apagado}
                    className="block h-auto w-full"
                />
            ))}
        </div>
    );
}
