import { LineasCampo } from "@/components/Campo";

// El partido abierto, vacío: mismas medidas para que nada salte al llegar los datos
export default function PartidoCargando() {
    return (
        <div aria-busy="true" aria-label="Cargando partido">
            <div className="flex min-h-11 items-center gap-6 border-b border-border px-4">
                <div className="skeleton h-5 w-9" />
                <div className="skeleton h-5 w-9" />
                <div className="skeleton h-5 w-9" />
            </div>
            <div className="px-4 pt-3">
                <div className="skeleton h-8 w-60" />
                <div className="skeleton mt-1.5 h-[18px] w-48" />
                <div className="skeleton mt-2 h-[92px] w-72 max-w-full" />
            </div>
            <div className="px-4 pt-3">
                <div className="relative h-[374px]">
                    <LineasCampo />
                </div>
                <div className="skeleton mt-3 h-[18px] w-64 max-w-full" />
            </div>
        </div>
    );
}
