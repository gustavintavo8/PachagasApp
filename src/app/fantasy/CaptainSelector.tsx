"use client";

import { useState } from "react";
import { setCaptain } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Crown } from "lucide-react";
import type { FantasyRoster, Profile } from "@/lib/types";

type RosterWithProfile = FantasyRoster & { profiles: Profile };

interface CaptainSelectorProps {
    teamId: string;
    roster: RosterWithProfile[];
}

export function CaptainSelector({ teamId, roster }: CaptainSelectorProps) {
    const currentCaptain = roster.find((r) => r.is_captain);
    const [selected, setSelected] = useState(currentCaptain?.player_id ?? "");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const isDirty = selected && selected !== currentCaptain?.player_id;

    async function handleSetCaptain() {
        if (!isDirty) return;
        setLoading(true);
        const result = await setCaptain(teamId, selected);
        if (result.success) {
            toast("Capitán actualizado", "success");
        } else {
            toast(result.error ?? "Error al cambiar el capitán", "error");
            setSelected(currentCaptain?.player_id ?? "");
        }
        setLoading(false);
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Crown size={18} className="text-accent" />
                    <CardTitle>Capitán</CardTitle>
                </div>
            </CardHeader>
            <div className="flex items-center gap-3">
                <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                    <option value="">Seleccionar capitán…</option>
                    {roster.map((entry) => (
                        <option key={entry.player_id} value={entry.player_id}>
                            {entry.profiles.username ?? entry.player_id}
                            {entry.is_captain ? " ★" : ""}
                        </option>
                    ))}
                </select>
                <Button
                    onClick={handleSetCaptain}
                    loading={loading}
                    disabled={!isDirty}
                    size="sm"
                >
                    Confirmar
                </Button>
            </div>
        </Card>
    );
}
