"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "./actions";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getAvatarUrl } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { POSITION_COLORS, POSITION_ICONS } from "@/lib/positions";

const positions = ["GK", "DEF", "MID", "FWD"] as const;
const positionLabels: Record<string, string> = {
    GK: "Portero (POR)",
    DEF: "Defensa (DEF)",
    MID: "Mediocampista (MED)",
    FWD: "Delantero (DEL)",
};

interface ProfileFormProps {
    userId: string;
    profile: Profile | null;
    isGuest?: boolean;
}

export function ProfileForm({ userId, profile, isGuest = false }: ProfileFormProps) {
    const router = useRouter();
    const [uiState, setUiState] = useState({ loading: false, success: false, error: null as string | null });
    const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null);
    const [selectedPosition, setSelectedPosition] = useState<string>(profile?.position ?? "MID");

    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        avatarPath
    );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setUiState({ loading: true, success: false, error: null });

        const formData = new FormData(e.currentTarget);
        const result = await updateProfile(formData);

        if (!result.success) {
            setUiState({ loading: false, success: false, error: result.error });
        } else {
            setUiState({ loading: false, success: true, error: null });
            setTimeout(() => setUiState(prev => ({ ...prev, success: false })), 3000);
            router.refresh();
        }
    }

    return (
        <Card className="relative overflow-hidden border border-border/80 bg-gradient-to-br from-surface to-surface-hover/50 shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
            {isGuest ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
                    El perfil no es editable en modo demo
                </div>
            ) : (
                <>
            <div className="mb-6 flex justify-center">
                <AvatarUpload
                    uid={userId}
                    url={avatarUrl}
                    fallback={profile?.username || "P"}
                    onUpload={(storagePath) => setAvatarPath(storagePath)}
                />
            </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <input type="hidden" name="avatar_url" value={avatarPath ?? ""} />
                    <Input
                        id="username"
                        name="username"
                        label="Apodo"
                        placeholder="ej. CR7, Messi, Fumble King"
                        defaultValue={profile?.username ?? ""}
                        required
                    />

                    {/* Position Select */}
                    <div className="space-y-3" role="radiogroup" aria-labelledby="position-label">
                        <p id="position-label" className="block text-sm font-medium text-foreground">
                            Tu Posición en el Campo
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {positions.map((pos) => {
                                const isSelected = selectedPosition === pos;
                                return (
                                    <label
                                        key={pos}
                                        className="cursor-pointer group flex-1"
                                    >
                                        <input
                                            type="radio"
                                            name="position"
                                            value={pos}
                                            checked={isSelected}
                                            onChange={() => setSelectedPosition(pos)}
                                            className="peer hidden"
                                            required
                                        />
                                        <div className={`flex flex-col items-center justify-center rounded-xl border p-4 text-[10px] sm:text-xs uppercase tracking-wider font-bold transition-all duration-300 ${isSelected
                                                ? `${POSITION_COLORS[pos as keyof typeof POSITION_COLORS]} scale-[1.02] shadow-lg`
                                                : "border-border/50 bg-black/20 text-muted hover:border-border hover:bg-black/40 hover:-translate-y-0.5"
                                            }`}>
                                            <span className={`text-2xl mb-1.5 ${isSelected ? "" : "opacity-50 group-hover:opacity-80 transition-opacity"}`}>
                                                {POSITION_ICONS[pos as keyof typeof POSITION_ICONS]}
                                            </span>
                                            {positionLabels[pos]}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {uiState.error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            {uiState.error}
                        </div>
                    )}

                    {uiState.success && (
                        <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                            ¡Perfil actualizado!
                        </div>
                    )}

                    <Button type="submit" loading={uiState.loading} size="lg" className="w-full shadow-[0_0_20px_rgba(204,255,0,0.15)] hover:shadow-[0_0_30px_rgba(204,255,0,0.25)] transition-shadow">
                        Guardar Perfil
                    </Button>
                </form>
                </>
            )}
            </div>
        </Card>
    );
}
