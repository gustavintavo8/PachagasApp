"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fraseVacio } from "@/lib/titulares";
import { timeAgo } from "@/lib/utils";
import {
    Bell,
    CalendarClock,
    CalendarX2,
    Medal,
    Shirt,
    Trophy,
    TriangleAlert,
    UserMinus,
    UserPlus,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hoja } from "@/components/Hoja";
import { Button } from "@/components/ui/Button";

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

// Los tipos que manda src/app/matches/actions.ts. Lo malo va en tarjeta amarilla.
const iconos: Record<string, { Icono: LucideIcon; aviso?: boolean }> = {
    join: { Icono: UserPlus },
    score: { Icono: Trophy },
    teams: { Icono: Shirt },
    cancel: { Icono: CalendarX2, aviso: true },
    reschedule: { Icono: CalendarClock },
    kick: { Icono: UserMinus, aviso: true },
    mvp: { Icono: Medal },
};

export function NotificationBell({ userId }: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fallo, setFallo] = useState(false);
    const [falloMarcar, setFalloMarcar] = useState(false);
    const [supabase] = useState(() => createClient());
    const router = useRouter();

    const unreadCount = notifications.filter((n) => !n.read).length;

    const cargar = useCallback(async () => {
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);
        setFallo(!!error);
        if (!error) setNotifications((data as Notification[]) || []);
        setLoading(false);
    }, [supabase, userId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- los setState van tras el await
        void cargar();
    }, [cargar]);

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
    }, [supabase, userId, router]);

    function abrir() {
        setOpen(true);
        // Lo que llegó con la conexión caída solo aparece al volver a pedirlo
        void cargar();
    }

    async function marcarLeidas(ids: string[]) {
        if (ids.length === 0) return;
        const { error } = await supabase
            .from("notifications")
            .update({ read: true })
            .in("id", ids);
        setFalloMarcar(!!error);
        if (error) return;
        setNotifications((prev) =>
            prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
        );
    }

    function abrirPartido(n: Notification) {
        setOpen(false);
        if (!n.read) void marcarLeidas([n.id]);
    }

    return (
        <>
            <button
                type="button"
                onClick={abrir}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
                className="pulsable relative flex h-11 w-11 items-center justify-center text-foreground"
            >
                <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
                {unreadCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center bg-foreground px-0.5 font-display text-[14px] font-extrabold tabular-nums leading-none text-background"
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            <Hoja open={open} onClose={() => setOpen(false)} title="Notificaciones">
                {unreadCount > 0 && (
                    <div className="px-4 pb-3">
                        <button
                            type="button"
                            onClick={() => void marcarLeidas(notifications.filter((n) => !n.read).map((n) => n.id))}
                            className="flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4 active:text-muted"
                        >
                            Marcar como leídas
                        </button>
                        {falloMarcar && (
                            <p className="t-meta flex items-center gap-2 text-muted">
                                <TriangleAlert size={18} strokeWidth={1.75} className="flex-none text-tarjeta" aria-hidden="true" />
                                No se han podido marcar.
                            </p>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="border-t border-border" role="status" aria-busy="true">
                        <span className="sr-only">Cargando</span>
                        {Array.from({ length: 3 }, (_, i) => (
                            <div key={`notif-skeleton-${i}`} className="flex min-h-[72px] items-center border-b border-border px-4">
                                <div className="skeleton h-10 w-full" />
                            </div>
                        ))}
                    </div>
                ) : fallo && notifications.length === 0 ? (
                    <div className="border-t border-border px-4 py-5">
                        <p className="flex items-center gap-2">
                            <TriangleAlert size={18} strokeWidth={1.75} className="flex-none text-tarjeta" aria-hidden="true" />
                            No se han podido cargar.
                        </p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
                            Reintentar
                        </Button>
                    </div>
                ) : notifications.length === 0 ? (
                    <p className="border-t border-border px-4 py-5 text-muted">
                        {fraseVacio("notificaciones", userId)}
                    </p>
                ) : (
                    <ul className="border-t border-border">
                        {notifications.map((n) => (
                            <li key={n.id} className="border-b border-border">
                                {n.match_id ? (
                                    <Link
                                        href={`/matches/${n.match_id}`}
                                        onClick={() => abrirPartido(n)}
                                        className="block active:bg-surface"
                                    >
                                        <FilaNotificacion n={n} />
                                    </Link>
                                ) : (
                                    <FilaNotificacion n={n} />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Hoja>
        </>
    );
}

function FilaNotificacion({ n }: { n: Notification }) {
    const { Icono, aviso } = iconos[n.type] ?? { Icono: Bell };

    return (
        <div className="flex min-h-14 items-start gap-3 px-4 py-3">
            <Icono
                size={18}
                strokeWidth={1.75}
                className={`mt-0.5 flex-none ${aviso ? "text-tarjeta" : "text-muted"}`}
                aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className={n.read ? "min-w-0 truncate font-medium" : "min-w-0 truncate font-bold"}>
                        {n.title}
                    </p>
                    <span className="t-meta flex-none tabular-nums text-muted">
                        {timeAgo(n.created_at)}
                    </span>
                </div>
                <p className="t-meta text-muted">{n.message}</p>
            </div>
            {!n.read && (
                <>
                    <span className="sr-only">Sin leer</span>
                    <span aria-hidden="true" className="mt-2 h-2 w-2 flex-none bg-foreground" />
                </>
            )}
        </div>
    );
}
