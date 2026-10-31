"use client";

import { ReactNode } from "react";
import { Hoja } from "@/components/Hoja";

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    className?: string;
}

export function Dialog({
    open,
    onClose,
    title,
    children,
    className,
}: DialogProps) {
    return (
        <Hoja open={open} onClose={onClose} title={title} className={className}>
            <div className="px-4">{children}</div>
        </Hoja>
    );
}
