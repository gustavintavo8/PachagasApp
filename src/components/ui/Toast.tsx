"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
};

const styles: Record<ToastType, string> = {
    success: "border-green-500/30 bg-green-500/10 text-green-400",
    error: "border-red-500/30 bg-red-500/10 text-red-400",
    info: "border-accent/30 bg-accent/10 text-accent",
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const toast = useCallback((message: string, type: ToastType = "info") => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {mounted &&
                createPortal(
                    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
                        {toasts.map((t) => (
                            <div
                                key={t.id}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl animate-toast-in",
                                    styles[t.type]
                                )}
                            >
                                {icons[t.type]}
                                <p className="text-sm font-medium">{t.message}</p>
                                <button
                                    onClick={() => dismiss(t.id)}
                                    className="ml-2 rounded-lg p-1 transition-colors hover:bg-white/10"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
        </ToastContext.Provider>
    );
}
