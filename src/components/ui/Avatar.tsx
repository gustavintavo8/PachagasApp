import { cn } from "@/lib/utils";
import Image from "next/image";

interface AvatarProps {
    src?: string | null;
    fallback: string;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    priority?: boolean;
}

const sizeMap = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
};

export function Avatar({
    src,
    fallback,
    size = "md",
    className,
    priority = false,
}: AvatarProps) {
    const initials = fallback
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div
            className={cn(
                "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/20 font-semibold text-accent",
                sizeMap[size],
                className
            )}
        >
            {src ? (
                <Image
                    src={src}
                    alt={fallback}
                    fill
                    className="object-cover"
                    sizes="80px"
                    priority={priority}
                />
            ) : (
                <span>{initials}</span>
            )}
        </div>
    );
}
