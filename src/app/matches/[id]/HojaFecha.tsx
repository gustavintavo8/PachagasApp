"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Hoja } from "@/components/Hoja";
import { useToast } from "@/components/ui/Toast";
import { aValorLocal } from "@/lib/titulares";
import type { Match } from "@/lib/types";
import { rescheduleMatch } from "../actions";

export function HojaFecha({ open, onClose, match }: { open: boolean; onClose: () => void; match: Match }) {
    const { toast } = useToast();
    const [valor, setValor] = useState(() => aValorLocal(match.date));
    const [guardando, setGuardando] = useState(false);

    async function confirmar() {
        if (!valor) {
            toast("Selecciona una fecha", "error");
            return;
        }
        setGuardando(true);
        try {
            const resultado = await rescheduleMatch(match.id, new Date(valor).toISOString());
            if (!resultado.success) {
                toast(resultado.error, "error");
                return;
            }
            toast("Fecha actualizada", "success");
            onClose();
        } catch {
            toast("No se ha guardado. Revisa la conexión e inténtalo otra vez.", "error");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <Hoja open={open} onClose={onClose} title="Cambiar fecha y hora">
            <div className="space-y-4 px-4">
                <label className="block">
                    <span className="t-meta mb-1.5 block text-muted">Nueva fecha y hora</span>
                    <input
                        type="datetime-local"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        className="block h-[52px] w-full min-w-0 appearance-none border border-border-hover bg-surface px-3 text-base text-foreground [color-scheme:dark]"
                    />
                </label>
                <Button type="button" size="lg" className="w-full" loading={guardando} onClick={confirmar}>
                    Confirmar nueva fecha
                </Button>
            </div>
        </Hoja>
    );
}
