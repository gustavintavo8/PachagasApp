import type { CSSProperties, ReactNode } from "react";
import { Panenka } from "@/components/Panenka";

export function Marcador({
    rojo,
    azul,
    children,
    className,
}: {
    rojo: number;
    azul: number;
    children?: ReactNode;
    className?: string;
}) {
    const total = rojo + azul;
    const costura = total === 0 ? 50 : Math.min(72, Math.max(28, (rojo / total) * 100));
    const reparto = {
        "--costura": `${costura}%`,
        "--costura-n": costura,
        "--cifras-rojo": String(rojo).length,
        "--cifras-azul": String(azul).length,
    } as CSSProperties;

    return (
        <section
            aria-label={`Rojo ${rojo}, Azul ${azul}`}
            className={["marcador", className].filter(Boolean).join(" ")}
            style={reparto}
        >
            <div className="marcador-campo marcador-rojo" />
            <div className="marcador-campo marcador-azul" />
            <div className="marcador-costura" />
            <div className="marcador-tanteo">
                <div>
                    <p className="marcador-equipo">Rojo</p>
                    <p className="marcador-cifra">{rojo}</p>
                </div>
                <div>
                    <p className="marcador-equipo">Azul</p>
                    <p className="marcador-cifra">{azul}</p>
                </div>
            </div>
            {children && <div className="marcador-pie">{children}</div>}
            <div className="marcador-centro">
                <Panenka size={104} />
            </div>
        </section>
    );
}
