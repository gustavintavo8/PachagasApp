import type { ReactNode } from "react";

// Texto largo: 16px, medida de lectura y encabezados en display. El contenido no se toca.
export function TextoLegal({ children }: { children: ReactNode }) {
    return (
        <article className="px-4 pb-14 pt-4 leading-[1.6] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-[30px] [&_h2]:font-extrabold [&_h2]:leading-[1.05] [&_li]:mb-2 [&_p]:mb-4 [&_strong]:font-bold [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
        </article>
    );
}

export function TituloLegal({ children }: { children: ReactNode }) {
    return <h1 className="t-titular mb-4 text-[min(96px,22vw)] font-black leading-[0.92]">{children}</h1>;
}
