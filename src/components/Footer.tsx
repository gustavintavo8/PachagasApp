"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// El pie legal no sale en cada pantalla: solo donde alguien lo va a buscar
const rutasConPie = ["/login", "/privacidad", "/aviso-legal", "/terminos", "/profile"];

const enlaces = [
    { href: "/privacidad", label: "Privacidad" },
    { href: "/aviso-legal", label: "Aviso legal" },
    { href: "/terminos", label: "Términos" },
];

export function Footer() {
    const pathname = usePathname();
    if (!rutasConPie.includes(pathname)) return null;

    return (
        <footer className="mx-auto w-full border-t border-border px-4 py-4 text-sm text-muted md:max-w-[640px]">
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5">
                {enlaces.map(({ href, label }) => (
                    <Link
                        key={href}
                        href={href}
                        className="inline-flex min-h-11 items-center hover:text-foreground active:text-foreground"
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            <p>Pachanga · Organiza tus partidos de fútbol</p>
        </footer>
    );
}
