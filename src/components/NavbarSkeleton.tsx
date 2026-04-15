import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

export function NavbarSkeleton() {
    return (
        <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Image
                        src="/icon-192.png"
                        alt="Pachanga"
                        width={32}
                        height={32}
                        className="rounded-lg opacity-50"
                    />
                    <span className="text-lg font-bold text-foreground">Pachanga</span>
                </div>

                {/* Desktop Nav Skeleton */}
                <div className="hidden items-center gap-1 md:flex">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={`nav-skeleton-${i}`} className="skeleton h-9 w-24 rounded-lg px-3 py-2" />
                    ))}
                </div>

                {/* User Section Skeleton (Desktop) */}
                <div className="hidden items-center gap-3 md:flex">
                    <div className="skeleton h-8 w-8 rounded-full" />
                    <div className="skeleton h-8 w-8 rounded-lg" />
                </div>

                {/* Mobile Toggle Skeleton */}
                <div className="rounded-lg p-2 text-muted md:hidden">
                    <Menu size={24} className="opacity-50" />
                </div>
            </div>
        </nav>
    );
}
