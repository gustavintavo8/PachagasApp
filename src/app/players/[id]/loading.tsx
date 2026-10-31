const CELDAS = Array.from({ length: 7 }, (_, i) => i);
const CIFRAS = Array.from({ length: 4 }, (_, i) => i);

// El layout final, con barras planas del tamaño real
export default function PlayerLoading() {
    return (
        <div aria-busy="true" aria-label="Cargando el jugador">
            <section className="px-4 pt-2 pb-6">
                <div className="skeleton h-[min(162px,41vw)] w-full" />
                <div className="mt-4 flex items-center gap-3">
                    <div className="skeleton h-14 w-14 shrink-0" />
                    <div className="skeleton h-5 flex-1" />
                </div>
                <div className="skeleton mt-4 h-[calc(2*min(62px,14.7vw))] w-full" />
                <div className="skeleton mt-4 h-14 w-52" />
                <div className="skeleton mt-2 h-[150px] w-full" />
                <div className="mt-2 grid grid-cols-7 gap-0.5">
                    {CELDAS.map((i) => (
                        <div key={i} className="skeleton h-[76px]" />
                    ))}
                </div>
            </section>
            <section className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 pt-6">
                {CIFRAS.map((i) => (
                    <div key={i}>
                        <div className="skeleton h-14 w-24" />
                        <div className="skeleton mt-1 h-5 w-28" />
                    </div>
                ))}
            </section>
        </div>
    );
}
