import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

// Aquí no hay tarjetas: un Card es un bloque separado por una regla.
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("border-t border-border px-4 py-5", className)}
            {...props}
        />
    )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("mb-3 flex items-center justify-between", className)}
            {...props}
        />
    )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<
    HTMLHeadingElement,
    HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("t-seccion text-foreground", className)}
        {...props}
    >
        {children}
    </h3>
));
CardTitle.displayName = "CardTitle";

export { Card, CardHeader, CardTitle };
