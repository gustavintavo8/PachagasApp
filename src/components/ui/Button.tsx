import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
}

// Al pulsar, inversión: tinta por suelo
const variantStyles: Record<ButtonVariant, string> = {
    primary:
        "border-2 border-foreground bg-foreground font-bold text-background hover:border-accent-hover hover:bg-accent-hover active:bg-background active:text-foreground",
    outline:
        "border-2 border-foreground font-bold text-foreground hover:bg-surface active:bg-foreground active:text-background",
    ghost:
        "font-medium text-foreground hover:bg-surface active:bg-surface-hover",
    danger:
        "border-2 border-tarjeta font-bold text-tarjeta active:bg-tarjeta active:text-background",
    secondary:
        "bg-surface font-medium text-foreground hover:bg-surface-hover active:bg-foreground active:text-background",
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: "min-h-11 px-3 text-[15px]",
    md: "min-h-12 px-5 text-base",
    lg: "min-h-[52px] px-6 text-[17px]",
};

// Para enlaces que tienen que parecer botones: <Link className={buttonClasses("outline", "lg")}>
export function buttonClasses(
    variant: ButtonVariant = "primary",
    size: ButtonSize = "md",
    className?: string
) {
    return cn(
        "pulsable relative inline-flex select-none items-center justify-center gap-2 text-center disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-wait aria-busy:opacity-100",
        variantStyles[variant],
        sizeStyles[size],
        className
    );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
            loading = false,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                className={buttonClasses(variant, size, cn(loading && "ocupado", className))}
                {...props}
            >
                {loading && (
                    <svg
                        className="ocupado-giro h-5 w-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
export { Button };
