// Mismo sitio que la barra real: la palabra no se mueve al llegar la sesión
export function NavbarSkeleton() {
    return (
        <header className="barra-superior relative z-40 pt-[env(safe-area-inset-top,0px)]">
            <div className="mx-auto flex h-12 w-full items-center justify-between gap-4 px-4 md:max-w-[640px]">
                <span className="flex min-h-11 items-center font-display text-[30px] font-black leading-none">
                    Pachanga
                </span>
            </div>
        </header>
    );
}
