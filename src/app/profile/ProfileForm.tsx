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

const positions = ["GK", "DEF", "MID", "FWD"] as const;
const positionLabels: Record<string, string> = {
    GK: "🧤 Portero",
    DEF: "🛡️ Defensa",
    MID: "🎯 Centrocampista",
    FWD: "⚡ Delantero",
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
    const [skillLevel, setSkillLevel] = useState(profile?.skill_level ?? 5);
    const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null);

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
        <Card>
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
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-300">
                        Posición
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {positions.map((pos) => (
                            <label
                                key={pos}
                                className="cursor-pointer"
                            >
                                <input
                                    type="radio"
                                    name="position"
                                    value={pos}
                                    defaultChecked={profile?.position === pos}
                                    className="peer hidden"
                                    required
                                />
                                <div className="flex items-center justify-center rounded-xl border border-border bg-zinc-800 px-4 py-3 text-sm font-medium text-muted transition-all peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent hover:border-border-hover">
                                    {positionLabels[pos]}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Skill Level Slider */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-300">
                        Nivel:{" "}
                        <span className="text-accent font-bold">{skillLevel}</span>
                        <span className="text-muted"> / 10</span>
                    </label>
                    <input
                        type="range"
                        name="skill_level"
                        min="1"
                        max="10"
                        value={skillLevel}
                        onChange={(e) => setSkillLevel(parseInt(e.target.value))}
                        className="w-full accent-[#ccff00]"
                    />
                    <div className="flex justify-between text-xs text-muted">
                        <span>Principiante</span>
                        <span>Pro</span>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                        ✅ ¡Perfil actualizado!
                    </div>
                )}

                <Button type="submit" loading={loading} size="lg" className="w-full">
                    Guardar Perfil
                </Button>
            </form>
        </Card>
    );
}
