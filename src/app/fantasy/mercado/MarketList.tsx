"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buyPlayer, sellPlayer } from "../actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { getAvatarUrl } from "@/lib/utils";
import { Search } from "lucide-react";
import type { Profile, FantasyTeam } from "@/lib/types";

interface MarketListProps {
    players: Profile[];
    team: FantasyTeam | null;
    myRosterIds: string[];
}

function formatValue(value: number | null) {
    if (value === null) return "Sin valor";
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}

export function MarketList({ players, team, myRosterIds }: MarketListProps) {
    const [query, setQuery] = useState("");
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const rosterSet = new Set(myRosterIds);

    const filtered =
        query === ""
            ? players
            : players.filter(
                  (p) => p.username?.toLowerCase().includes(query.toLowerCase()) ?? false
              );

    async function handleBuy(player: Profile) {
        if (!team) return;
        setLoadingId(player.id);
        const result = await buyPlayer(team.id, player.id);
        if (result.success) {
            toast(`${player.username ?? "Jugador"} fichado`, "success");
            router.refresh();
        } else {
            toast(result.error ?? "Error al fichar", "error");
        }
        setLoadingId(null);
    }

    async function handleSell(player: Profile) {
        if (!team) return;
        setLoadingId(player.id);
        const result = await sellPlayer(team.id, player.id);
        if (result.success) {
            toast(`${player.username ?? "Jugador"} vendido`, "success");
            router.refresh();
        } else {
            toast(result.error ?? "Error al vender", "error");
        }
        setLoadingId(null);
    }

    return (
        <div className="space-y-4">
            {/* Budget banner */}
            {team && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                    <span className="text-sm text-muted">Presupuesto disponible</span>
                    <span className="text-lg font-semibold text-accent">
                        {formatValue(team.budget)}
                    </span>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                    type="text"
                    placeholder="Buscar jugador…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
            </div>

            {/* Players */}
            <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((player) => {
                    const inRoster = rosterSet.has(player.id);
                    const price = player.market_value;
                    const canBuy =
                        !inRoster && !!team && price !== null && team.budget >= price;
                    const avatarUrl = getAvatarUrl(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        player.avatar_url
                    );

                    return (
                        <Card key={player.id} className="flex items-center gap-3 p-4">
                            <Avatar
                                src={avatarUrl}
                                fallback={player.username || "?"}
                                size="sm"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">
                                    {player.username ?? "Sin nombre"}
                                </p>
                                <p className="text-xs text-muted">
                                    {player.position ?? "—"} · {player.elo_rating} RP
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <span className="text-sm font-semibold text-foreground">
                                    {formatValue(price)}
                                </span>
                                {price !== null && (
                                    inRoster ? (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            loading={loadingId === player.id}
                                            onClick={() => handleSell(player)}
                                        >
                                            Vender
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            loading={loadingId === player.id}
                                            disabled={!canBuy}
                                            onClick={() => handleBuy(player)}
                                        >
                                            Fichar
                                        </Button>
                                    )
                                )}
                            </div>
                        </Card>
                    );
                })}

                {filtered.length === 0 && (
                    <p className="col-span-2 py-12 text-center text-sm text-muted">
                        No se encontraron jugadores
                    </p>
                )}
            </div>
        </div>
    );
}
