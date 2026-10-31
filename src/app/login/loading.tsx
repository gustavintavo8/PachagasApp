// Mismo marco que la puerta: nombre, Panenka sobre la regla y el formulario
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="pt-[calc(env(safe-area-inset-top,0px)+20px)]">
            <span className="sr-only">Cargando</span>
            <div className="px-4">
                <div className="skeleton h-[min(120px,30vw)] w-full" />
            </div>
            <div className="mt-5 flex items-end justify-between gap-2 border-b border-border px-4">
                <div className="flex-1 space-y-1.5 pb-4">
                    <div className="skeleton h-[30px] w-full" />
                    <div className="skeleton h-[30px] w-2/3" />
                </div>
                <div className="skeleton h-[min(136px,36vw)] w-[min(136px,36vw)] shrink-0 rounded-full" />
            </div>
            <div className="space-y-4 px-4 pt-[60px]">
                <div className="skeleton h-[76px] w-full" />
                <div className="skeleton h-[76px] w-full" />
                <div className="skeleton h-[52px] w-full" />
            </div>
        </div>
    );
}
