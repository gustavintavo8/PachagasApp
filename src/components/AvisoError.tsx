import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvisoErrorProps {
    children: ReactNode;
    /** Reintentar o lo que toque, después de la frase */
    accion?: ReactNode;
    className?: string;
    /** Sobre un campo tarjeta el icono va en tinta */
    sobreTarjeta?: boolean;
}

// Dentro del bloque que falló: una frase, y la tarjeta solo en el icono
export function AvisoError({ children, accion, className, sobreTarjeta = false }: AvisoErrorProps) {
    return (
        <div role="alert" className={cn("flex items-start gap-2.5", className)}>
            <TriangleAlert
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
                className={cn("mt-[3px] shrink-0", !sobreTarjeta && "text-tarjeta")}
            />
            <div className="min-w-0 flex-1">
                <p>{children}</p>
                {accion}
            </div>
        </div>
    );
}
