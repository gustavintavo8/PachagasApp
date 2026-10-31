"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AvisoError } from "@/components/AvisoError";
import { Button } from "@/components/ui/Button";

/** El error dentro del bloque que falló: el marco se queda y solo se repite la lectura. */
export function ErrorBloque({ children }: { children: string }) {
    const router = useRouter();
    const [pendiente, empezar] = useTransition();

    return (
        <AvisoError
            className="px-4 py-8 font-medium"
            accion={
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={pendiente}
                    onClick={() => empezar(() => router.refresh())}
                    className="mt-4"
                >
                    Reintentar
                </Button>
            }
        >
            {children}
        </AvisoError>
    );
}
