"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Season } from "@/lib/types";

interface SeasonSelectorProps {
    seasons: Season[];
    selectedSlug: string;
    name?: string;
}

// El select nativo va encima y transparente: la lista la abre el sistema, a tamaño de pulgar.
export function SeasonSelector({ seasons, selectedSlug, name = "season" }: SeasonSelectorProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [cargando, empezar] = useTransition();
    const selectedSeason = seasons.find((season) => season.slug === selectedSlug);

    function handleChange(value: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(name, value);
        empezar(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    }

    return (
        <label
            className={cn(
                "relative -mr-2 flex min-h-11 flex-none items-center gap-1 px-2 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foreground",
                cargando && "text-muted"
            )}
        >
            <span className="font-medium">{selectedSeason?.name ?? selectedSlug}</span>
            <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
            <select
                name={name}
                aria-label="Temporada"
                value={selectedSlug}
                onChange={(event) => handleChange(event.target.value)}
                className="absolute inset-0 w-full cursor-pointer appearance-none opacity-0"
            >
                {seasons.map((season) => (
                    <option key={season.id} value={season.slug}>
                        {season.name.replace(" ", " ")}
                    </option>
                ))}
            </select>
        </label>
    );
}
