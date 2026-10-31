"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, id, "aria-describedby": describedBy, ...props }, ref) => {
        const generado = useId();
        const inputId = id ?? generado;
        const errorId = `${inputId}-error`;

        return (
            <div className="space-y-2">
                {label && (
                    <label htmlFor={inputId} className="t-meta block text-muted">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={cn(describedBy, error && errorId) || undefined}
                    className={cn(
                        "min-h-12 w-full border border-border-hover bg-surface px-4 py-2 text-base text-foreground placeholder:text-muted focus:border-foreground focus:outline-none disabled:opacity-50",
                        error && "border-tarjeta focus:border-tarjeta",
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p id={errorId} className="t-meta text-tarjeta">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
export { Input };
