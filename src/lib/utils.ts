import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getAvatarUrl(supabaseUrl: string, path: string | null) {
    if (!path) return null;
    return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

export function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("es-ES", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
    });
}

export function getTimeUntil(dateString: string) {
    const now = new Date();
    const target = new Date(dateString);
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) return "Empezado";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
