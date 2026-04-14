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
}

export function ProfileForm({ userId, profile }: ProfileFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null);
    const [selectedPosition, setSelectedPosition] = useState<string>(profile?.position ?? "MID");

    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        avatarPath
    );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        const formData = new FormData(e.currentTarget);
        const result = await updateProfile(formData);

        if (result?.error) {
            setError(result.error);
        } else {
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            router.refresh();
        }
        setLoading(false);
    }

    return (
        <Card className="relative overflow-hidden border border-border/80 bg-gradient-to-br from-surface to-surface-hover/50 shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
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
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                        Tu Posición en el Campo
                    </label>
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

                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                        ¡Perfil actualizado!
                    </div>
                )}

                <Button type="submit" loading={loading} size="lg" className="w-full shadow-[0_0_20px_rgba(204,255,0,0.15)] hover:shadow-[0_0_30px_rgba(204,255,0,0.25)] transition-shadow">
                    Guardar Perfil
                </Button>
            </form>
            </div>
        </Card>
    );
}
