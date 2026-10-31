// Mismo marco que el chat vacío: la barra de escribir no se mueve al llegar
export default function Loading() {
    return (
        <div
            role="status"
            aria-busy="true"
            className="flex h-[calc(100dvh-var(--barra-superior)-var(--barra-inferior))] flex-col overflow-hidden"
        >
            <span className="sr-only">Cargando</span>
            <div className="min-h-0 flex-1 pt-1">
                <div className="px-4">
                    <div className="skeleton h-[min(120px,30vw)] w-3/4" />
                    <div className="skeleton mt-2 h-5 w-44" />
                </div>
                <div className="mt-4 flex items-center gap-3 px-4">
                    <div className="skeleton h-[min(156px,40vw,20dvh)] flex-1" />
                    <div className="skeleton h-[min(156px,40vw,20dvh)] w-[min(156px,40vw,20dvh)] shrink-0 rounded-full" />
                </div>
                <div className="mt-4 border-t border-border">
                    {[0, 1, 2, 3].map((fila) => (
                        <div key={fila} className="flex min-h-14 items-center border-b border-border px-4">
                            <div className="skeleton h-5 w-3/4" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex gap-2 border-t border-border px-4 pb-6 pt-3 md:pb-3">
                <div className="skeleton h-12 flex-1" />
                <div className="skeleton h-12 w-12" />
            </div>
        </div>
    );
}
