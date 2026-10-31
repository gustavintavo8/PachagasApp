"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** El error dentro del bloque que falló: el marco se queda y solo se repite la lectura. */
export function ErrorBloque({ children }: { children: string }) {
    const router = useRouter();
    const [pendiente, empezar] = useTransition();

    return (
        <div className="px-4 py-8">
            <p className="flex items-start gap-2 text-base font-medium">
                <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 flex-none text-tarjeta" />
                {children}
            </p>
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
        </div>
    );
}
