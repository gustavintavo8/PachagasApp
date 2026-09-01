"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Season } from "@/lib/types";

interface SeasonSelectorProps {
    seasons: Season[];
    selectedSlug: string;
    name?: string;
}

export function SeasonSelector({ seasons, selectedSlug, name = "season" }: SeasonSelectorProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const selectedSeason = seasons.find((season) => season.slug === selectedSlug);

    function handleChange(value: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(name, value);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }

    return (
        <label className="flex items-center gap-2 text-sm text-muted">
            <span>Temporada</span>
            <span className="font-semibold text-foreground">{selectedSeason?.name ?? selectedSlug}</span>
            <select
                name={name}
                aria-label="Temporada"
                value={selectedSlug}
                onChange={(event) => handleChange(event.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors focus:border-accent focus:outline-none"
            >
                {seasons.map((season) => (
                    <option key={season.id} value={season.slug}>
                        {season.name.replace(" ", "\u00a0")}
                    </option>
                ))}
            </select>
        </label>
    );
}
