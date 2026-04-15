import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "rounded-2xl border border-border bg-surface p-6 shadow-lg shadow-black/10",
                className
            )}
            {...props}
        />
    )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("mb-4 flex items-center justify-between", className)}
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
        className={cn("text-lg font-semibold text-foreground", className)}
        {...props}
    >
        {children}
    </h3>
));
CardTitle.displayName = "CardTitle";

export { Card, CardHeader, CardTitle };
