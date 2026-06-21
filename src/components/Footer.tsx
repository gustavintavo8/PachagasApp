import Link from "next/link";

export function Footer() {
    return (
        <footer className="border-t border-border bg-surface px-4 py-6 pb-20 text-center text-xs text-muted md:pb-6">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <Link href="/privacidad" className="transition-colors hover:text-accent">Privacidad</Link>
                <Link href="/aviso-legal" className="transition-colors hover:text-accent">Aviso legal</Link>
                <Link href="/terminos" className="transition-colors hover:text-accent">Términos</Link>
            </nav>
            <p className="mt-3 text-muted/70">Pachanga · Organiza tus partidos de fútbol</p>
        </footer>
    );
}
