"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Download, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { AvisoError } from "@/components/AvisoError";
import { Filas } from "@/components/Filas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deleteAccount, exportMyData } from "./data-actions";

const ERROR_EXPORTAR = "No se pudo generar tu exportación de datos. Inténtalo de nuevo.";
const ERROR_BORRAR = "No se pudo eliminar la cuenta. Inténtalo de nuevo.";

// Fila de acción: misma regla y altura que las filas de enlace
const fila = "w-full gap-3 px-4 text-base";

export function AccountDataPanel() {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [errorExportar, setErrorExportar] = useState<string | null>(null);
    const campoRef = useRef<HTMLInputElement>(null);
    const botonRef = useRef<HTMLButtonElement>(null);
    const tarjetaRef = useRef<HTMLDivElement>(null);
    const abierto = useRef(false);

    // El foco va al campo al abrir y vuelve al botón al cancelar
    useEffect(() => {
        if (confirming) {
            // Entera a la vista: si no, los botones se quedan debajo de la barra
            campoRef.current?.focus({ preventScroll: true });
            tarjetaRef.current?.scrollIntoView({ block: "center" });
        } else if (abierto.current) {
            botonRef.current?.focus();
        }
        abierto.current = confirming;
    }, [confirming]);

    // Perfil se guarda oculto al cambiar de pestaña o salir: el borrado no se queda armado
    useEffect(() => () => {
        abierto.current = false;
        setConfirming(false);
        setConfirmText("");
        setLoading(false);
        setError(null);
        setErrorExportar(null);
    }, []);

    async function handleDelete() {
        setLoading(true);
        setError(null);
        try {
            const result = await deleteAccount();
            if (!result.success) {
                setError(result.error);
                setLoading(false);
                return;
            }
            router.push("/login");
        } catch {
            setError(ERROR_BORRAR);
            setLoading(false);
        }
    }

    async function handleExport() {
        setExporting(true);
        setErrorExportar(null);
        try {
            const result = await exportMyData();
            if (!result.success) {
                setErrorExportar(result.error);
                return;
            }
            const blob = new Blob([result.data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "mis-datos-pachanga.json";
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setErrorExportar(ERROR_EXPORTAR);
        } finally {
            setExporting(false);
        }
    }

    function cancelar() {
        setConfirming(false);
        setConfirmText("");
        setError(null);
    }

    return (
        <section aria-labelledby="datos-titulo" className="mt-12">
            <div className="px-4">
                <h2 id="datos-titulo" className="t-seccion">Tus datos y privacidad</h2>
                <p className="mt-2 text-muted">
                    Descarga una copia de tus datos o elimina tu cuenta permanentemente.
                </p>
            </div>

            <Filas className="mt-4">
                <li className="border-b border-border">
                    <Button variant="ghost" size="lg" className={fila} loading={exporting} onClick={handleExport}>
                        <span className="flex-1 text-left">Descargar mis datos</span>
                        <Download size={18} strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                    {errorExportar && <AvisoError className="px-4 pb-3">{errorExportar}</AvisoError>}
                </li>
                <li className="border-b border-border">
                    <form action={signOut}>
                        <BotonSalir />
                    </form>
                </li>
            </Filas>

            {/* Lo destructivo, lo último: una tarjeta amarilla de verdad */}
            <div className="mt-10">
                {!confirming ? (
                    <div className="px-4 pb-10">
                        <Button
                            ref={botonRef}
                            variant="danger"
                            size="lg"
                            className="w-full"
                            onClick={() => setConfirming(true)}
                        >
                            Eliminar mi cuenta
                        </Button>
                    </div>
                ) : (
                    <div ref={tarjetaRef} className="bg-tarjeta px-4 pb-6 pt-5 text-background">
                        <p className="t-seccion">Esta acción es irreversible.</p>
                        <p className="mt-1 font-medium">
                            Escribe <strong className="font-bold">ELIMINAR</strong> para confirmar.
                        </p>
                        <div className="mt-4">
                            <Input
                                ref={campoRef}
                                aria-label="Escribe ELIMINAR para confirmar"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="ELIMINAR"
                                autoComplete="off"
                                autoCapitalize="characters"
                                autoCorrect="off"
                                spellCheck={false}
                                enterKeyHint="done"
                                className="border-background bg-background text-foreground"
                            />
                        </div>
                        {error && <AvisoError sobreTarjeta className="mt-3 font-medium">{error}</AvisoError>}
                        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                            <Button
                                variant="danger"
                                size="lg"
                                loading={loading}
                                disabled={confirmText !== "ELIMINAR"}
                                onClick={handleDelete}
                                className="whitespace-nowrap border-background bg-background px-3 text-tarjeta active:text-tarjeta"
                            >
                                Confirmar borrado
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={cancelar}
                                className="border-background px-3 text-background hover:bg-transparent active:bg-background active:text-tarjeta"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

function BotonSalir() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="ghost" size="lg" loading={pending} className={fila}>
            <span className="flex-1 text-left">Cerrar sesión</span>
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
        </Button>
    );
}
