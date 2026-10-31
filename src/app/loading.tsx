// Mismo marco que Inicio, con barras planas del tamaño real
export default function Loading() {
    return (
        <div
            role="status"
            aria-busy="true"
            className="flex min-h-[calc(100dvh-var(--barra-superior)-var(--barra-inferior))] flex-col"
        >
            <span className="sr-only">Cargando</span>

            <div className="flex-1 pb-6 pt-1">
                <div className="px-4">
                    {/* Pregunta y puesto */}
                    <div className="flex min-h-11 items-center justify-between gap-3">
                        <div className="skeleton h-[22px] w-40" />
                        <div className="skeleton h-5 w-24" />
                    </div>
                    {/* Respuesta */}
                    <div className="skeleton mt-1 h-[min(135px,34vw)] w-full" />
                    {/* Día, hora y sitio */}
                    <div className="skeleton mt-3.5 h-6 w-4/5" />
                    <div className="skeleton mt-1 h-6 w-1/3" />

                    {/* Faltan */}
                    <div className="skeleton mt-5 h-[min(80px,20vw)] w-44" />
                    {/* Petos */}
                    <div className="mt-2.5 grid grid-cols-[repeat(14,minmax(0,28px))] justify-between gap-x-1">
                        {Array.from({ length: 14 }, (_, i) => (
                            <div key={`peto-skeleton-${i}`} className="skeleton aspect-[11/13]" />
                        ))}
                    </div>
                    {/* Sin decir nada */}
                    <div className="skeleton mt-3 h-5 w-full" />
                    <div className="skeleton mt-1 h-5 w-1/2" />
                </div>

                {/* Último resultado, a sangre */}
                <div className="skeleton mt-6 h-[min(84px,21.5vw)] w-full" />
                <div className="px-4 pt-2.5">
                    <div className="skeleton h-5 w-3/5" />
                    <div className="skeleton mt-1 h-5 w-2/5" />
                </div>
            </div>

            {/* Acción */}
            <div className="px-4 pb-5 pt-3">
                <div className="skeleton h-[52px] w-full" />
            </div>
        </div>
    );
}
