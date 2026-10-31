"use client";

import type { ReactNode, RefObject } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HojaProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
    /** Dónde cae el foco al abrir. Sin esto, en la propia hoja. */
    initialFocus?: RefObject<HTMLElement | null>;
}

// Hoja inferior arrastrable en móvil, centrada en md+. Los estilos están en globals.css.
export function Hoja({ open, onClose, title, description, children, className, initialFocus }: HojaProps) {
    return (
        <Drawer.Root
            open={open}
            onOpenChange={(abierta) => {
                if (!abierta) onClose();
            }}
        >
            <Drawer.Portal>
                <Drawer.Backdrop className="hoja-fondo" />
                <Drawer.VirtualKeyboardProvider>
                    <Drawer.Viewport className="hoja-marco">
                        <Drawer.Popup className={cn("hoja", className)} initialFocus={initialFocus}>
                            <div aria-hidden="true" className="hoja-asa" />
                            <div className="flex flex-none items-start justify-between gap-4 px-4 pb-3 pt-2 md:pt-4">
                                <div className="min-w-0">
                                    <Drawer.Title className="t-seccion">{title}</Drawer.Title>
                                    {description && (
                                        <Drawer.Description className="t-meta mt-1 text-muted">
                                            {description}
                                        </Drawer.Description>
                                    )}
                                </div>
                                <Drawer.Close
                                    aria-label="Cerrar"
                                    className="-mr-2.5 -mt-1.5 flex h-11 w-11 flex-none items-center justify-center text-muted hover:text-foreground active:text-foreground"
                                >
                                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                                </Drawer.Close>
                            </div>
                            <Drawer.Content className="hoja-cuerpo scroll-interno">
                                {children}
                            </Drawer.Content>
                        </Drawer.Popup>
                    </Drawer.Viewport>
                </Drawer.VirtualKeyboardProvider>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
