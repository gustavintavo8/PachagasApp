import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, id, ...props }, ref) => (
        <div className="space-y-2">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
                    {label}
                </label>
            )}
            <input
                ref={ref}
                id={id}
                className={cn(
                    "w-full rounded-xl border border-border bg-zinc-800 px-4 py-3 text-foreground placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
                    error && "border-danger focus:border-danger focus:ring-danger",
                    className
                )}
                {...props}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
        </div>
    )
);

Input.displayName = "Input";
export { Input };
