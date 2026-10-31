"use client";

import { Button } from "@/components/ui/Button";
import { Hoja } from "@/components/Hoja";

export function HojaCancelar({
    open,
    onClose,
    cancelando,
    onCancelar,
}: {
    open: boolean;
    onClose: () => void;
    cancelando: boolean;
    onCancelar: () => void;
}) {
    return (
        <Hoja open={open} onClose={onClose} title="¿Cancelar partido?">
            <div className="space-y-4 px-4">
                <p className="text-muted">Esta acción es irreversible. Todos los jugadores serán notificados.</p>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant="danger"
                        size="lg"
                        className="flex-1"
                        loading={cancelando}
                        onClick={onCancelar}
                    >
                        Sí, cancelar
                    </Button>
                </div>
            </div>
        </Hoja>
    );
}
