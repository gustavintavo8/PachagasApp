"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

import { redeemCommunityAccess } from "./actions";

const GENERIC_ERROR = "No se pudo activar el acceso. Inténtalo de nuevo.";

export function AccessForm() {
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const submittedCode = code;

        startTransition(async () => {
            try {
                const result = await redeemCommunityAccess(submittedCode);

                if (!result.success) {
                    const message = result.error ?? GENERIC_ERROR;
                    setError(message);
                    toast(message, "error");
                    return;
                }

                toast("Acceso activado. Ya puedes entrar.", "success");
                router.replace("/");
                router.refresh();
            } catch {
                setError(GENERIC_ERROR);
                toast(GENERIC_ERROR, "error");
            } finally {
                setCode("");
            }
        });
    }

    return (
        <Card className="w-full max-w-md border border-border/80 bg-gradient-to-br from-surface to-surface-hover/40 shadow-xl shadow-black/20">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    id="community-access-code"
                    label="Código de acceso"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Introduce tu código"
                    required
                    disabled={isPending}
                    error={error ?? undefined}
                />

                {error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                    >
                        {error}
                    </div>
                )}

                <Button type="submit" loading={isPending} className="w-full" size="lg">
                    Entrar
                </Button>
            </form>
        </Card>
    );
}
