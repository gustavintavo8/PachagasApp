"use client";

import { Button } from "@/components/ui/Button";
import { Hoja } from "@/components/Hoja";

/** Solo sale cuando borrarse cuesta algo: «aviso» dice qué. */
export function HojaBorrarme({
    open,
    aviso,
    onClose,
    onConfirmar,
}: {
    open: boolean;
    aviso: string | null;
    onClose: () => void;
    onConfirmar: () => void;
}) {
    return (
        <Hoja open={open} onClose={onClose} title="¿Te borras?">
            <div className="space-y-4 px-4">
                <p className="text-muted">{aviso}</p>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant="danger"
                        size="lg"
                        className="flex-1"
                        onClick={() => {
                            onClose();
                            onConfirmar();
                        }}
                    >
                        Sí, me borro
                    </Button>
                </div>
            </div>
        </Hoja>
    );
}
