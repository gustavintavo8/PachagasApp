"use client";

import { Button } from "@/components/ui/Button";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle size={40} className="text-red-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
                Algo salió mal
            </h1>
            <p className="mb-6 max-w-md text-center text-muted">
                Ha ocurrido un error inesperado. Puedes intentar recargar la página
                o volver al inicio.
            </p>
            <div className="flex gap-3">
                <Button onClick={reset} variant="outline" size="lg">
                    <RotateCcw size={18} />
                    Reintentar
                </Button>
                <Button onClick={() => (window.location.href = "/")} size="lg">
                    Volver al inicio
                </Button>
            </div>
        </div>
    );
}
