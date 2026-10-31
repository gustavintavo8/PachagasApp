const FILAS = Array.from({ length: 7 }, (_, i) => i);

// El layout final, con barras planas del tamaño real
export default function LeaderboardLoading() {
    return (
        <div aria-busy="true" aria-label="Cargando el ranking">
            <div className="px-4 pt-2">
                <div className="flex items-baseline justify-between">
                    <div className="skeleton h-8 w-28" />
                    <div className="skeleton h-5 w-24" />
                </div>
                <div className="skeleton mt-6 h-[calc(2*min(84px,21.5vw)*0.92)] w-full" />
                <div className="mt-6 grid grid-cols-[auto_1fr] gap-x-8">
                    <div className="skeleton h-16 w-16" />
                    <div className="skeleton h-16 w-44" />
                    <div className="skeleton mt-1 h-5 w-10" />
                    <div className="skeleton mt-1 h-5 w-36" />
                </div>
                <div className="mt-6 flex items-center gap-3">
                    <div className="skeleton h-14 w-14 shrink-0" />
                    <div className="skeleton h-11 flex-1" />
                </div>
            </div>
            <div className="mt-6 h-12 border-b border-border" />
            <div className="px-4 pt-6 pb-2">
                <div className="skeleton h-8 w-32" />
            </div>
            <ul className="border-t border-border">
                {FILAS.map((i) => (
                    <li key={i} className="flex h-11 items-center gap-3 border-b border-border px-4">
                        <div className="skeleton h-4 w-5" />
                        <div className="skeleton h-4 flex-1" />
                        <div className="skeleton h-5 w-36" />
                    </li>
                ))}
            </ul>
        </div>
    );
}
