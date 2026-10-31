"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fraseError } from "@/lib/titulares";

export default function PlayersError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="px-4 pt-6">
            <TriangleAlert size={18} strokeWidth={1.75} className="text-tarjeta" aria-hidden="true" />
            <h1 className="t-titular mt-2">{fraseError("jugadores")}</h1>
            <Button onClick={reset} size="lg" className="mt-6 w-full">
                Reintentar
            </Button>
        </div>
    );
}
