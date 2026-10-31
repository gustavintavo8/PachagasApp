"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "./actions";
import { AvatarUpload } from "@/components/AvatarUpload";
import { AvisoError } from "@/components/AvisoError";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { POSITION_FULL } from "@/lib/positions";
import { charsCartel, lineasCartel } from "@/lib/titulares";
import { getAvatarUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const posiciones = ["GK", "DEF", "MID", "FWD"] as const;

interface ProfileFormProps {
    userId: string;
    profile: Profile | null;
    /** Frase bajo el nombre: dónde estás en la tabla */
    titular?: string;
    /** Al lado del avatar */
    lateral?: ReactNode;
    /** Entre la cabecera y el formulario: la temporada y los enlaces */
    children?: ReactNode;
}

export function ProfileForm({ userId, profile, titular, lateral, children }: ProfileFormProps) {
    const router = useRouter();
    const [uiState, setUiState] = useState({ loading: false, success: false, error: null as string | null });
    const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null);
    const [selectedPosition, setSelectedPosition] = useState<string>(profile?.position ?? "MID");
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (temporizador.current) clearTimeout(temporizador.current);
    }, []);

    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        avatarPath
    );

    const nombre = profile?.username?.trim() || "Sin apodo";
    const lineas = lineasCartel(nombre);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setUiState({ loading: true, success: false, error: null });

        const formData = new FormData(e.currentTarget);

        try {
            const result = await updateProfile(formData);

            if (!result.success) {
                setUiState({ loading: false, success: false, error: result.error });
                return;
            }

            setUiState({ loading: false, success: true, error: null });
            if (temporizador.current) clearTimeout(temporizador.current);
            temporizador.current = setTimeout(() => setUiState(prev => ({ ...prev, success: false })), 3000);
            router.refresh();
        } catch {
            setUiState({ loading: false, success: false, error: "Error al actualizar el perfil. Inténtalo de nuevo." });
        }
    }

    return (
        <>
            <header className="px-4 pt-1">
                <h1 className="t-cartel" style={{ "--chars": Math.max(...lineas.map((l) => charsCartel(l))) } as CSSProperties}>
                    {lineas.map((linea) => (
                        <span key={linea} className="block">{linea}</span>
                    ))}
                </h1>
                {titular && <p className="t-seccion mt-3">{titular}</p>}
            </header>

            <div className="mt-5 flex items-start gap-4 px-4">
                <AvatarUpload
                    uid={userId}
                    url={avatarUrl}
                    fallback={nombre}
                    onUpload={(storagePath) => setAvatarPath(storagePath)}
                />
                <div className="min-w-0 flex-1">{lateral}</div>
            </div>

            {children}

            <form onSubmit={handleSubmit} className="mt-10 space-y-5 px-4">
                <h2 className="t-seccion">Editar perfil</h2>
                <input type="hidden" name="avatar_url" value={avatarPath ?? ""} />
                <Input
                    id="username"
                    name="username"
                    label="Apodo"
                    placeholder="ej. Manolín, el Pichichi"
                    defaultValue={profile?.username ?? ""}
                    required
                    maxLength={30}
                    autoComplete="nickname"
                    enterKeyHint="done"
                />

                <div className="space-y-2" role="radiogroup" aria-labelledby="position-label">
                    <p id="position-label" className="t-meta text-muted">
                        Posición
                    </p>
                    <div className="grid grid-cols-4 border border-border-hover">
                        {posiciones.map((valor, i) => (
                            <label key={valor} className={cn("relative cursor-pointer", i > 0 && "border-l border-border-hover")}>
                                {/* Oculto a la vista y no a display:none: las flechas del teclado siguen funcionando */}
                                <input
                                    type="radio"
                                    name="position"
                                    value={valor}
                                    checked={selectedPosition === valor}
                                    onChange={() => setSelectedPosition(valor)}
                                    className="peer sr-only"
                                    required
                                />
                                <span className="pulsable flex min-h-14 select-none items-center justify-center text-center font-display text-[min(23px,5.6vw)] font-semibold text-muted active:bg-surface-hover peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground">
                                    {POSITION_FULL[valor]}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {uiState.error && <AvisoError>{uiState.error}</AvisoError>}

                <Button type="submit" loading={uiState.loading} size="lg" className="w-full">
                    {uiState.success ? "Guardado" : "Guardar perfil"}
                </Button>
                <p role="status" className="sr-only">
                    {uiState.success ? "Perfil guardado" : ""}
                </p>
            </form>
        </>
    );
}
