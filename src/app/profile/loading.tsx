// Mismo marco que Perfil, con barras planas del tamaño real
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="pt-1">
            <span className="sr-only">Cargando</span>

            <div className="px-4">
                {/* Apodo */}
                <div className="skeleton h-[min(120px,30vw)] w-3/4" />
                {/* Dónde estás */}
                <div className="skeleton mt-3 h-[32px] w-4/5" />
            </div>

            {/* Avatar y RP */}
            <div className="mt-5 flex items-start gap-4 px-4">
                <div className="skeleton h-[min(176px,45vw)] w-[min(176px,45vw)] shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="skeleton h-[min(76px,19vw)] w-full" />
                    <div className="skeleton mt-1 h-[32px] w-12" />
                    <div className="skeleton mt-3 h-[38px] w-4/5" />
                </div>
            </div>

            {/* Cifras */}
            <div className="mt-[66px] px-4">
                <div className="flex justify-between gap-4 border-t border-border pt-5">
                    <div className="skeleton h-[80px] w-16" />
                    <div className="skeleton h-[80px] w-16" />
                    <div className="skeleton h-[80px] w-28" />
                </div>
            </div>
        </div>
    );
}
