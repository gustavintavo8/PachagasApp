"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteAccount, exportMyData } from "./data-actions";

export function AccountDataPanel() {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    async function handleDelete() {
        setLoading(true);
        setError(null);
        const result = await deleteAccount();
        if (!result.success) {
            setError(result.error);
            setLoading(false);
            return;
        }
        router.push("/login");
    }

    async function handleExport() {
        setExporting(true);
        setError(null);
        const result = await exportMyData();
        setExporting(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        const blob = new Blob([result.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mis-datos-pachanga.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <Card className="mt-6 border border-border/80 bg-surface">
            <h2 className="text-lg font-semibold text-foreground">Tus datos y privacidad</h2>
            <p className="mt-1 text-sm text-muted">
                Descarga una copia de tus datos o elimina tu cuenta permanentemente.
            </p>

            <div className="mt-4 flex flex-col gap-3">
                <Button variant="secondary" className="w-full" loading={exporting} onClick={handleExport}>
                    Descargar mis datos
                </Button>

                {!confirming ? (
                    <Button
                        variant="danger"
                        className="w-full"
                        onClick={() => setConfirming(true)}
                    >
                        Eliminar mi cuenta
                    </Button>
                ) : (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                        <p className="text-sm text-red-300">
                            Esta acción es irreversible. Escribe <strong>ELIMINAR</strong> para confirmar.
                        </p>
                        <input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="ELIMINAR"
                            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                        />
                        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                        <div className="mt-3 flex gap-2">
                            <Button
                                variant="danger"
                                loading={loading}
                                disabled={confirmText !== "ELIMINAR"}
                                onClick={handleDelete}
                            >
                                Confirmar borrado
                            </Button>
                            <Button variant="secondary" onClick={() => setConfirming(false)}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
