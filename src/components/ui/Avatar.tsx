"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";

interface AvatarProps {
    src?: string | null;
    fallback: string;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    priority?: boolean;
    /** El tamaño real en pantalla, si className lo agranda: next/image elige la foto con esto */
    sizes?: string;
}

const sizeMap = {
    sm: "h-8 w-8 text-lg",
    md: "h-10 w-10 text-2xl",
    lg: "h-14 w-14 text-[32px]",
    xl: "h-20 w-20 text-5xl",
};

// Por grafemas: [0] partiría un emoji por la mitad
function inicial(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio) return "?";
    const primero = new Intl.Segmenter("es", { granularity: "grapheme" }).segment(limpio);
    return Array.from(primero)[0].segment.toLocaleUpperCase("es");
}

export function Avatar({
    src,
    fallback,
    size = "md",
    className,
    priority = false,
    sizes = "80px",
}: AvatarProps) {
    // Se guarda qué URL falló, así una foto nueva se vuelve a intentar
    const [fallida, setFallida] = useState<string | null>(null);
    const verFoto = src && src !== fallida;

    return (
        <div
            className={cn(
                "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface font-display font-extrabold leading-none text-foreground",
                sizeMap[size],
                className
            )}
        >
            {/* Debajo de la foto: se ve mientras carga y si falla */}
            <span aria-hidden="true">{inicial(fallback)}</span>
            {verFoto && (
                <Image
                    src={src}
                    alt={fallback}
                    fill
                    className="object-cover"
                    sizes={sizes}
                    priority={priority}
                    // next.config solo optimiza Supabase. Las de Google se piden tal cual y sin referer
                    unoptimized={!/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src)}
                    referrerPolicy="no-referrer"
                    onError={() => setFallida(src)}
                />
            )}
        </div>
    );
}
