import type { CSSProperties } from "react";

// Mismo marco que Perfil de arriba abajo: el pie empieza fuera de la pantalla, como en la página
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <span className="sr-only">Cargando</span>

            <div className="px-4 pt-1">
                {/* Apodo: un nombre de seis letras, con la clase de verdad */}
                <div
                    aria-hidden="true"
                    className="t-cartel skeleton w-fit text-transparent"
                    style={{ "--chars": 6 } as CSSProperties}
                >
                    Pelayo
                </div>
                {/* Dónde estás */}
                <div className="skeleton mt-3 h-[32px] w-4/5" />
            </div>

            {/* Avatar y RP */}
            <div className="mt-5 flex items-start gap-4 px-4">
                <div className="w-[min(176px,45vw)] shrink-0">
                    <div className="skeleton h-[min(176px,45vw)] w-[min(176px,45vw)]" />
                    <div className="flex min-h-11 items-center">
                        <div className="skeleton h-4 w-28" />
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="skeleton h-[min(76px,19vw)] w-full" />
                    <div className="skeleton mt-1 h-[32px] w-12" />
                    <div className="skeleton mt-3 h-[38px] w-4/5" />
                </div>
            </div>

            {/* Cifras */}
            <div className="mt-6 px-4">
                <div className="flex justify-between gap-4 border-t border-border pt-5">
                    <div className="skeleton h-[min(80px,19vw)] w-16" />
                    <div className="skeleton h-[min(80px,19vw)] w-16" />
                    <div className="skeleton h-[min(80px,19vw)] w-28" />
                </div>
                <div className="mt-6 flex items-center gap-3">
                    <div className="skeleton h-12 w-12 shrink-0 rounded-full" />
                    <div className="skeleton h-[22px] flex-1" />
                </div>
            </div>

            {/* Historial y Tu ficha */}
            <div className="mt-6 border-t border-border">
                {[0, 1].map((fila) => (
                    <div key={fila} className="flex min-h-14 items-center border-b border-border px-4">
                        <div className="skeleton h-5 w-2/5" />
                    </div>
                ))}
            </div>

            {/* Editar perfil */}
            <div className="mt-10 space-y-5 px-4">
                <div className="skeleton h-[32px] w-40" />
                <div className="space-y-2">
                    <div className="skeleton h-[19px] w-14" />
                    <div className="skeleton h-12 w-full" />
                </div>
                <div className="space-y-2">
                    <div className="skeleton h-[19px] w-16" />
                    <div className="skeleton h-14 w-full" />
                </div>
                <div className="skeleton h-[52px] w-full" />
            </div>

            {/* Tus datos y privacidad */}
            <div className="mt-12">
                <div className="px-4">
                    <div className="skeleton h-[32px] w-3/4" />
                    <div className="skeleton mt-2 h-[46px] w-full" />
                </div>
                <div className="mt-4 border-t border-border">
                    {[0, 1].map((fila) => (
                        <div key={fila} className="flex min-h-[52px] items-center border-b border-border px-4">
                            <div className="skeleton h-5 w-2/5" />
                        </div>
                    ))}
                </div>
                <div className="mt-10 px-4 pb-10">
                    <div className="skeleton h-[52px] w-full" />
                </div>
            </div>
        </div>
    );
}
