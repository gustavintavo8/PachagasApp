import type { CSSProperties } from "react";

// Mismo marco que el chat vacío, con sus mismas clases: la regla y la barra de escribir no se mueven al llegar
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
                    {/* El mismo cartel en transparente: mide lo mismo a cualquier ancho */}
                    <div
                        aria-hidden="true"
                        className="t-cartel skeleton w-fit text-transparent"
                        style={{ "--chars": 7 } as CSSProperties}
                    >
                        Panenka
                    </div>
                    <div className="skeleton mt-1 h-[19px] w-44" />
                </div>

                <div className="flex items-end justify-between gap-2 border-b border-border px-4">
                    <div className="min-w-0 flex-1 pb-4">
                        <div className="skeleton h-[min(84px,21vw)] w-4/5" />
                    </div>
                    <div className="skeleton -mb-[12px] h-[min(168px,43vw,22dvh)] w-[min(168px,43vw,22dvh)] shrink-0 rounded-full" />
                </div>

                <div>
                    {[0, 1, 2, 3].map((fila) => (
                        <div key={fila} className="flex min-h-14 items-center border-b border-border px-4">
                            <div className="skeleton h-5 w-3/4" />
                        </div>
                    ))}
                </div>

                <div className="space-y-1 px-4 py-4">
                    <div className="skeleton h-[15px] w-full" />
                    <div className="skeleton h-[15px] w-full" />
                    <div className="skeleton h-[15px] w-2/3" />
                </div>
            </div>
            <div className="flex gap-2 border-t border-border px-4 pb-6 pt-3 md:pb-3">
                <div className="skeleton h-12 flex-1" />
                <div className="skeleton h-12 w-12" />
            </div>
        </div>
    );
}
