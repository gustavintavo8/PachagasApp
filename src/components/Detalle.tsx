import { ViewTransition, type ReactNode } from "react";

// Entrar a un detalle: 200ms, opacidad y 12px. Salir o cambiar de pestaña, nada (ver globals.css).
export function Detalle({ children }: { children: ReactNode }) {
    return (
        <ViewTransition default="none" enter="detalle-entra" exit="none">
            <div>{children}</div>
        </ViewTransition>
    );
}
