"use client";

import {
    createContext,
    useContext,
    useMemo,
    type ReactNode,
} from "react";
import { Toaster, toast as sonner } from "sonner";

type ToastType = "success" | "error" | "info";

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

function toast(message: string, type: ToastType = "info") {
    sonner(message, { className: type === "error" ? "aviso-error" : undefined });
}

// --barra-inferior ya incluye el safe area cuando hay barra
const separacion = { bottom: "calc(max(var(--barra-inferior), env(safe-area-inset-bottom, 0px)) + 8px)" };

export function ToastProvider({ children }: { children: ReactNode }) {
    const value = useMemo(() => ({ toast }), []);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* sonner ya es aria-live="polite". Sin role="alert": access.spec cuenta las alertas. */}
            <Toaster
                theme="dark"
                position="bottom-center"
                offset={separacion}
                mobileOffset={separacion}
                duration={4000}
                visibleToasts={3}
                containerAriaLabel="Avisos"
                toastOptions={{ unstyled: true, classNames: { toast: "aviso" } }}
            />
        </ToastContext.Provider>
    );
}
