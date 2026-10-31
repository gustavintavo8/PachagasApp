"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fraseError } from "@/lib/titulares";

export default function LeaderboardError({
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
        <div className="px-4 pt-2">
            <h1 className="t-seccion font-black">Ranking</h1>
            <TriangleAlert size={18} strokeWidth={1.75} className="mt-8 text-tarjeta" aria-hidden="true" />
            <p className="t-titular mt-2">{fraseError("ranking")}</p>
            <Button onClick={reset} size="lg" className="mt-6 w-full">
                Reintentar
            </Button>
        </div>
    );
}
