"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    const router = useRouter();
    const [reintentando, empezar] = useTransition();

    useEffect(() => {
        console.error(error);
    }, [error]);

    // reset() solo vuelve a pintar lo que ya había: el refresh pide los datos otra vez
    function reintentar() {
        empezar(() => {
            router.refresh();
            reset();
        });
    }

    return (
        <div className="px-4 pt-2">
            <h1 className="t-seccion font-black">Ranking</h1>
            <TriangleAlert size={18} strokeWidth={1.75} className="mt-8 text-tarjeta" aria-hidden="true" />
            <p className="t-titular mt-2">{fraseError("ranking")}</p>
            <Button onClick={reintentar} loading={reintentando} size="lg" className="mt-6 w-full">
                Reintentar
            </Button>
        </div>
    );
}
