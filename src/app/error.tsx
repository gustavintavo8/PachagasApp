"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TriangleAlert } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();
    const [reintentando, empezar] = useTransition();

    useEffect(() => {
        console.error(error);
    }, [error]);

    // reset() solo vuelve a pintar lo que ya había: el refresh pide los datos otra vez
    function reintentar() {
        // Sin red, router.refresh() acaba en la página de error del navegador
        if (navigator.onLine === false) {
            reset();
            return;
        }
        empezar(() => {
            router.refresh();
            reset();
        });
    }

    return (
        <div className="flex min-h-[60dvh] flex-col justify-center px-4 py-8">
            <TriangleAlert size={18} strokeWidth={1.75} className="text-tarjeta" aria-hidden="true" />
            <h1 className="t-titular mt-2">Algo salió mal.</h1>
            <p className="mt-3 text-muted">
                Se ha roto algo por el camino. Prueba otra vez o vuelve al inicio.
            </p>
            <div className="mt-6 flex flex-col gap-2 md:flex-row">
                <Button onClick={reintentar} loading={reintentando} size="lg">
                    Reintentar
                </Button>
                <Button onClick={() => (window.location.href = "/")} variant="outline" size="lg">
                    Volver al inicio
                </Button>
            </div>
        </div>
    );
}
