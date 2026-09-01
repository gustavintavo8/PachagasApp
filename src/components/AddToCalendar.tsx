"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import {
    canAddMatchToCalendar,
    createGoogleCalendarUrl,
    createIcsContent,
    createIcsFilename,
    createMatchCalendarEvent,
    createOutlookCalendarUrl,
    type CalendarEventData,
} from "@/lib/calendar-event";
import type { Match } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

interface AddToCalendarProps {
    match: Pick<Match, "id" | "date" | "location" | "status">;
}

export function AddToCalendar({ match }: AddToCalendarProps): React.JSX.Element | null {
    const { toast } = useToast();
    const [origin, setOrigin] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const firstItemRef = useRef<HTMLAnchorElement>(null);

    // The origin must be read after hydration so the server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setOrigin(window.location.origin), []);

    const available = useMemo(
        () => origin !== null && canAddMatchToCalendar(match.status, match.date),
        [match.date, match.status, origin]
    );

    const event = useMemo<CalendarEventData | null>(() => {
        if (!available || !origin) return null;

        try {
            return createMatchCalendarEvent({
                id: match.id,
                date: match.date,
                location: match.location,
                origin,
            });
        } catch {
            return null;
        }
    }, [available, match.date, match.id, match.location, origin]);

    const calendarUrls = useMemo(() => {
        if (!event) return null;

        return {
            google: createGoogleCalendarUrl(event),
            outlook: createOutlookCalendarUrl(event),
        };
    }, [event]);

    useEffect(() => {
        if (!open) return;

        firstItemRef.current?.focus();

        const handlePointerDown = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    if (!available) return null;

    const prepareEvent = () => {
        if (!origin) return null;

        try {
            return createMatchCalendarEvent({
                id: match.id,
                date: match.date,
                location: match.location,
                origin,
            });
        } catch {
            toast("No se pudo preparar el evento", "error");
            setOpen(false);
            return null;
        }
    };

    const handleDownload = () => {
        const currentEvent = prepareEvent();
        if (!currentEvent) return;

        try {
            const content = createIcsContent(currentEvent);
            const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = createIcsFilename(currentEvent);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
            setOpen(false);
        } catch {
            toast("No se pudo preparar el evento", "error");
            setOpen(false);
        }
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="calendar-options-menu"
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-all hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                <CalendarPlus size={14} />
                Añadir al calendario
            </button>

            {open && calendarUrls && (
                <div
                    id="calendar-options-menu"
                    role="menu"
                    aria-label="Opciones de calendario"
                    className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-xl shadow-black/20"
                >
                    <a
                        ref={firstItemRef}
                        href={calendarUrls.google}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <ExternalLink size={14} />
                        Google Calendar
                    </a>
                    <a
                        href={calendarUrls.outlook}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <ExternalLink size={14} />
                        Outlook
                    </a>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={handleDownload}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <Download size={14} />
                        Descargar archivo .ics
                    </button>
                </div>
            )}
        </div>
    );
}
