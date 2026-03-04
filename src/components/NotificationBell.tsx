"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    match_id: string | null;
    read: boolean;
    created_at: string;
}

interface NotificationBellProps {
    userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    const unreadCount = notifications.filter((n) => !n.read).length;

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(20);
            setNotifications((data as Notification[]) || []);
            setLoading(false);
        }
        fetch();
    }, [userId]);

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel(`notifs-${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    setNotifications((prev) => [payload.new as Notification, ...prev]);
                    router.refresh();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    async function markAllRead() {
        const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
        if (unreadIds.length === 0) return;
        await supabase
            .from("notifications")
            .update({ read: true })
            .in("id", unreadIds);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }

    function timeAgo(dateStr: string) {
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return "ahora";
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    }

    const typeIcons: Record<string, string> = {
        join: "👋",
        teams: "🔀",
        score: "🏆",
        chat: "💬",
        default: "🔔",
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-all hover:border-accent hover:text-accent"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-zinc-950">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        role="button"
                        tabIndex={0}
                        aria-label="Close notifications"
                        onClick={() => setOpen(false)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape" || e.key === "Enter") {
                                setOpen(false);
                            }
                        }}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-zinc-900 shadow-2xl shadow-black/50">
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                            <h3 className="text-sm font-semibold text-foreground">
                                Notificaciones
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-xs text-accent hover:underline"
                                >
                                    Marcar como leídas
                                </button>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="space-y-2 p-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="skeleton h-14 rounded-xl" />
                                    ))}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-muted">
                                    Sin notificaciones
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`border-b border-border px-4 py-3 transition-colors ${!n.read ? "bg-accent/5" : "hover:bg-zinc-800/50"
                                            }`}
                                    >
                                        {n.match_id ? (
                                            <Link
                                                href={`/matches/${n.match_id}`}
                                                onClick={() => setOpen(false)}
                                                className="block"
                                            >
                                                <NotifContent n={n} typeIcons={typeIcons} timeAgo={timeAgo} />
                                            </Link>
                                        ) : (
                                            <NotifContent n={n} typeIcons={typeIcons} timeAgo={timeAgo} />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function NotifContent({
    n,
    typeIcons,
    timeAgo,
}: {
    n: { type: string; title: string; message: string; created_at: string; read: boolean };
    typeIcons: Record<string, string>;
    timeAgo: (d: string) => string;
}) {
    return (
        <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-base">
                {typeIcons[n.type] || typeIcons.default}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <p className="text-xs font-semibold text-foreground truncate">
                        {n.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted">
                        {timeAgo(n.created_at)}
                    </span>
                </div>
                <p className="text-xs text-muted truncate">{n.message}</p>
            </div>
            {!n.read && (
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
            )}
        </div>
    );
}
