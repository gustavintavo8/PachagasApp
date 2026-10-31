const FILAS = Array.from({ length: 8 }, (_, i) => i);

// El layout final, con barras planas del tamaño real
export default function PlayersLoading() {
    return (
        <div aria-busy="true" aria-label="Cargando los jugadores">
            <div className="flex items-baseline justify-between px-4 pt-2">
                <div className="skeleton h-[min(62px,14.7vw)] w-44" />
                <div className="skeleton h-5 w-24" />
            </div>
            <div className="mt-4 px-4">
                <div className="skeleton h-[52px] w-full" />
            </div>
            <div className="mt-2 h-12 border-b border-border" />
            <div className="px-4 pt-4 pb-2">
                <div className="skeleton h-5 w-24" />
            </div>
            <ul className="border-t border-border">
                {FILAS.map((i) => (
                    <li key={i} className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2">
                        <div className="skeleton h-10 w-10 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                            <div className="skeleton h-5 w-32" />
                            <div className="skeleton h-4 w-48 max-w-full" />
                        </div>
                        <div className="skeleton h-7 w-12" />
                    </li>
                ))}
            </ul>
        </div>
    );
}
