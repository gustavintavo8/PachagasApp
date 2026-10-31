"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
        <div className="px-4 pt-6">
            <TriangleAlert size={18} strokeWidth={1.75} className="text-tarjeta" aria-hidden="true" />
            <h1 className="t-titular mt-2">{fraseError("jugadores")}</h1>
            <Button onClick={reintentar} loading={reintentando} size="lg" className="mt-6 w-full">
                Reintentar
            </Button>
        </div>
    );
}
