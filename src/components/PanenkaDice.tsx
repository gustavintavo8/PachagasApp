import type { ReactNode } from "react";
import { Panenka } from "@/components/Panenka";

export function PanenkaDice({
    children,
    firma = false,
    size = 48,
    className,
}: {
    children: ReactNode;
    firma?: boolean;
    size?: number;
    className?: string;
}) {
    return (
        <figure className={["flex items-start gap-3", className].filter(Boolean).join(" ")}>
            <Panenka size={size} className="shrink-0" />
            <figcaption className="min-w-0 self-center text-base font-medium leading-[1.35] [overflow-wrap:anywhere]">
                <div>{children}</div>
                {firma && <div className="mt-1 text-balance text-sm">Por Panenka, que lo vio todo</div>}
            </figcaption>
        </figure>
    );
}
