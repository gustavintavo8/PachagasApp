const CELDAS = Array.from({ length: 7 }, (_, i) => i);
const CIFRAS = Array.from({ length: 3 }, (_, i) => i);

// El layout final, con barras planas del tamaño real
export default function PlayerLoading() {
    return (
        <div aria-busy="true" aria-label="Cargando el jugador">
            <section className="px-4 pb-5">
                <div className="skeleton mt-1 h-[min(192px,48vw)] w-full" />
                <div className="mt-3 flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="skeleton h-5 w-full" />
                        <div className="skeleton mt-1 h-14 w-40" />
                    </div>
                    <div className="skeleton h-14 w-14 shrink-0" />
                </div>
                <div className="skeleton mt-3 h-8 w-full" />
                <div className="skeleton mt-1 h-[150px] w-full" />
                <div className="mt-2 grid grid-cols-7 gap-0.5">
                    {CELDAS.map((i) => (
                        <div key={i} className="skeleton h-[76px]" />
                    ))}
                </div>
            </section>
            <section className="grid grid-cols-[1.7fr_1fr_auto] gap-x-4 px-4 pt-5">
                {CIFRAS.map((i) => (
                    <div key={i}>
                        <div className="skeleton h-14 w-20" />
                        <div className="skeleton mt-1 h-5 w-20" />
                    </div>
                ))}
            </section>
        </div>
    );
}
