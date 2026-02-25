"use client";

import { useState } from "react";
import { updateProfile } from "./actions";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getAvatarUrl } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const positions = ["GK", "DEF", "MID", "FWD"] as const;
const positionLabels: Record<string, string> = {
    GK: "🧤 Goalkeeper",
    DEF: "🛡️ Defender",
    MID: "🎯 Midfielder",
    FWD: "⚡ Forward",
};

interface ProfileFormProps {
    userId: string;
    profile: Profile | null;
}

export function ProfileForm({ userId, profile }: ProfileFormProps) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [skillLevel, setSkillLevel] = useState(profile?.skill_level ?? 5);

    const avatarUrl = getAvatarUrl(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        profile?.avatar_url ?? null
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
                />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                    id="username"
                    name="username"
                    label="Nickname"
                    placeholder="e.g. CR7, Messi, Fumble King"
                    defaultValue={profile?.username ?? ""}
                    required
                />

                {/* Position Select */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-300">
                        Position
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
                        Skill Level:{" "}
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
                        className="w-full accent-[#39FF14]"
                    />
                    <div className="flex justify-between text-xs text-muted">
                        <span>Beginner</span>
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
                        ✅ Profile updated!
                    </div>
                )}

                <Button type="submit" loading={loading} size="lg" className="w-full">
                    Save Profile
                </Button>
            </form>
        </Card>
    );
}
