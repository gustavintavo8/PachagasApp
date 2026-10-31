"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Hoja } from "@/components/Hoja";

interface AddToCalendarProps {
    match: Pick<Match, "id" | "date" | "location" | "status">;
}

const ESCRITORIO = "(min-width: 768px)";
const ALTO_MENU_PX = 160;

function suscribirEscritorio(aviso: () => void) {
    const consulta = window.matchMedia(ESCRITORIO);
    consulta.addEventListener("change", aviso);
    return () => consulta.removeEventListener("change", aviso);
}

const OPCION =
    "flex min-h-14 w-full select-none items-center gap-3 border-b border-border px-4 text-left text-base font-medium text-foreground last:border-b-0 hover:bg-surface active:bg-surface md:min-h-12";

export function AddToCalendar({ match }: AddToCalendarProps): React.JSX.Element | null {
    const { toast } = useToast();
    const [origin, setOrigin] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [event, setEvent] = useState<CalendarEventData | null>(null);
    const [haciaArriba, setHaciaArriba] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const firstItemRef = useRef<HTMLAnchorElement>(null);
    const menuItemRefs = useRef<Array<HTMLElement | null>>([]);
    // En el teléfono, hoja. En escritorio, menú junto al botón.
    const escritorio = useSyncExternalStore(
        suscribirEscritorio,
        () => window.matchMedia(ESCRITORIO).matches,
        () => false
    );

    // The origin must be read after hydration so the server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setOrigin(window.location.origin), []);

    const available = useMemo(
        () => origin !== null && canAddMatchToCalendar(match.status, match.date),
        [match.date, match.status, origin]
    );

    const calendarUrls = useMemo(() => {
        if (!event) return null;

        return {
            google: createGoogleCalendarUrl(event),
            outlook: createOutlookCalendarUrl(event),
        };
    }, [event]);

    // La hoja ya atrapa el foco, cierra con Escape y al tocar fuera
    useEffect(() => {
        if (!open || !escritorio) return;

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
    }, [open, escritorio]);

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

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const items = menuItemRefs.current.filter((item): item is HTMLElement => item !== null);
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        if (currentIndex === -1 || items.length === 0) return;

        let nextIndex: number | null = null;
        if (event.key === "ArrowDown") {
            nextIndex = (currentIndex + 1) % items.length;
        } else if (event.key === "ArrowUp") {
            nextIndex = (currentIndex - 1 + items.length) % items.length;
        } else if (event.key === "Home") {
            nextIndex = 0;
        } else if (event.key === "End") {
            nextIndex = items.length - 1;
        }

        if (nextIndex !== null) {
            event.preventDefault();
            items[nextIndex].focus();
        }
    };

    const handleTriggerClick = () => {
        if (open) {
            setOpen(false);
            return;
        }

        const currentEvent = prepareEvent();
        if (!currentEvent) return;

        // El botón suele quedar al pie de la página: el menú no se puede salir de la pantalla
        const boton = triggerRef.current?.getBoundingClientRect();
        setHaciaArriba(!!boton && window.innerHeight - boton.bottom < ALTO_MENU_PX);
        setEvent(currentEvent);
        setOpen(true);
    };

    const menu = calendarUrls && (
        <div
            id="calendar-options-menu"
            role="menu"
            aria-label="Opciones de calendario"
            onKeyDown={handleMenuKeyDown}
            className={
                escritorio
                    ? `absolute right-0 z-50 w-64 border border-border-hover bg-background ${haciaArriba ? "bottom-full mb-1" : "top-full mt-1"}`
                    : "border-t border-border"
            }
        >
            <a
                ref={(element) => {
                    firstItemRef.current = element;
                    menuItemRefs.current[0] = element;
                }}
                href={calendarUrls.google}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={OPCION}
            >
                <ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
                Google Calendar
            </a>
            <a
                ref={(element) => {
                    menuItemRefs.current[1] = element;
                }}
                href={calendarUrls.outlook}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={OPCION}
            >
                <ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
                Outlook
            </a>
            <button
                ref={(element) => {
                    menuItemRefs.current[2] = element;
                }}
                type="button"
                role="menuitem"
                onClick={handleDownload}
                className={OPCION}
            >
                <Download size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
                Descargar archivo .ics
            </button>
        </div>
    );

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="calendar-options-menu"
                onClick={handleTriggerClick}
                className={buttonClasses("outline", "sm")}
            >
                <CalendarPlus size={18} strokeWidth={1.75} aria-hidden="true" />
                Añadir al calendario
            </button>

            {escritorio ? (
                open && menu
            ) : (
                <Hoja open={open} onClose={() => setOpen(false)} title="Añadir al calendario">
                    {menu}
                </Hoja>
            )}
        </div>
    );
}
