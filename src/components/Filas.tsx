import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilasProps {
    children: ReactNode;
    className?: string;
    "aria-label"?: string;
}

// Lista con reglas de 1px. La primera regla la pone la lista, el resto cada fila.
export function Filas({ children, className, "aria-label": ariaLabel }: FilasProps) {
    return (
        <ul aria-label={ariaLabel} className={cn("border-t border-border", className)}>
            {children}
        </ul>
    );
}

interface FilaProps {
    nombre: ReactNode;
    /** Cifra a la derecha, en display y con números tabulares */
    cifra?: ReactNode;
    /** Línea secundaria bajo el nombre */
    detalle?: ReactNode;
    /** Antes del nombre: posición, avatar, peto */
    inicio?: ReactNode;
    /** Toda la fila es el enlace */
    href?: string;
    /** Toda la fila es un botón. Solo desde componentes cliente. */
    onClick?: () => void;
    /** Tu fila: invertida */
    tu?: boolean;
    "aria-current"?: "true" | "page";
    className?: string;
}

export function Fila({
    nombre,
    cifra,
    detalle,
    inicio,
    href,
    onClick,
    tu = false,
    "aria-current": ariaCurrent,
    className,
}: FilaProps) {
    const clases = cn(
        "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left",
        tu && "bg-foreground text-background",
        (href || onClick) && cn("select-none", tu ? "active:bg-accent-hover" : "active:bg-surface"),
        className
    );

    const contenido = (
        <>
            {inicio !== undefined && <span className="flex flex-none items-center">{inicio}</span>}
            <span className="min-w-0 flex-1">
                <span className={cn("block truncate", tu ? "font-bold" : "font-medium")}>{nombre}</span>
                {detalle !== undefined && (
                    <span className={cn("t-meta block truncate", !tu && "text-muted")}>{detalle}</span>
                )}
            </span>
            {cifra !== undefined && <span className="t-cifra flex-none text-[26px]">{cifra}</span>}
        </>
    );

    return (
        <li className="border-b border-border">
            {href ? (
                <Link href={href} aria-current={ariaCurrent} className={clases}>
                    {contenido}
                </Link>
            ) : onClick ? (
                <button type="button" onClick={onClick} aria-current={ariaCurrent} className={clases}>
                    {contenido}
                </button>
            ) : (
                <div className={clases}>{contenido}</div>
            )}
        </li>
    );
}
