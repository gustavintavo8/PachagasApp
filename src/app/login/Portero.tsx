import { Panenka } from "@/components/Panenka";

// Panenka de pie sobre la regla, como en la puerta de una discoteca
export function Portero({ frase }: { frase: string }) {
    return (
        <div className="flex items-end justify-between gap-2 border-b border-border px-4">
            <p className="t-seccion min-w-0 flex-1 pb-4">{frase}</p>
            <Panenka
                size={136}
                animated
                className="-mb-[13px] h-[min(136px,36vw)] w-[min(136px,36vw)] shrink-0"
            />
        </div>
    );
}
