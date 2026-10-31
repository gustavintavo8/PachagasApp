"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { AvisoError } from "@/components/AvisoError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { frasePuerta } from "@/lib/titulares";

import { signOut } from "../login/actions";
import { Portero } from "../login/Portero";
import { redeemCommunityAccess } from "./actions";

const GENERIC_ERROR = "No se pudo activar el acceso. Inténtalo de nuevo.";

export function AccessForm() {
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    // El campo se desactiva al enviar y pierde el foco: tras un error se devuelve
    useEffect(() => {
        if (error && !isPending) inputRef.current?.focus();
    }, [error, isPending]);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const submittedCode = code;

        startTransition(async () => {
            try {
                const result = await redeemCommunityAccess(submittedCode);

                if (!result.success) {
                    setError(result.error ?? GENERIC_ERROR);
                    return;
                }

                toast("Acceso activado. Ya puedes entrar.", "success");
                router.replace("/");
                router.refresh();
            } catch {
                setError(GENERIC_ERROR);
            } finally {
                setCode("");
            }
        });
    }

    return (
        <>
            <div className="mt-4">
                <Portero frase={frasePuerta(error ? "rechazo" : "acceso")} />
            </div>

            <div className="px-4 pt-5">
                <p className="mb-5 text-muted">
                    Introduce tu código para activar el acceso a la comunidad.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 md:max-w-[440px]">
                    <Input
                        ref={inputRef}
                        id="community-access-code"
                        label="Código de acceso"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        placeholder="Introduce tu código"
                        required
                        disabled={isPending}
                        aria-invalid={error ? true : undefined}
                        className={error ? "border-tarjeta focus:border-tarjeta" : undefined}
                    />

                    {error && <AvisoError>{error}</AvisoError>}

                    <Button type="submit" loading={isPending} className="w-full" size="lg">
                        Entrar
                    </Button>
                </form>
            </div>

            {/* Con la cuenta equivocada esta es la única salida */}
            <form
                action={signOut}
                className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-8"
            >
                <BotonSalir />
            </form>
        </>
    );
}

function BotonSalir() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="ghost" loading={pending} className="-ml-3 text-muted">
            Cerrar sesión
        </Button>
    );
}
