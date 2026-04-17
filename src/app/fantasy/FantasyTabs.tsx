"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
    { href: "/fantasy", label: "Mi Equipo" },
    { href: "/fantasy/mercado", label: "Mercado" },
    { href: "/fantasy/clasificacion", label: "Clasificación" },
];

export function FantasyTabs() {
    const pathname = usePathname();

    return (
        <div className="mb-6 flex gap-1 border-b border-border">
            {tabs.map((tab) => {
                const active = pathname === tab.href;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                            active
                                ? "border-accent text-accent"
                                : "border-transparent text-muted hover:text-foreground"
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
