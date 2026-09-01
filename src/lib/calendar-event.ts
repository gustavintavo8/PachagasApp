export type CalendarMatchStatus = "open" | "closed" | "finished" | "cancelled";

export interface MatchCalendarInput {
    id: string;
    date: string;
    location: string;
    origin: string;
}

export interface CalendarEventData {
    id: string;
    title: string;
    start: Date;
    end: Date;
    location: string;
    description: string;
    url: string;
}

const EVENT_DURATION_MS = 60 * 60 * 1000;
const DESCRIPTION_PREFIX = "Partido organizado en Pachangas";

function parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new RangeError("La fecha del partido no es válida");
    }
    return date;
}

function toCompactUtc(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function canAddMatchToCalendar(
    status: CalendarMatchStatus,
    date: string,
    now = new Date()
): boolean {
    if (status !== "open" && status !== "closed") {
        return false;
    }

    try {
        return parseDate(date).getTime() > now.getTime();
    } catch {
        return false;
    }
}

export function createMatchCalendarEvent(input: MatchCalendarInput): CalendarEventData {
    const start = parseDate(input.date);
    const origin = new URL(input.origin).origin;
    const url = `${origin}/matches/${encodeURIComponent(input.id)}`;

    return {
        id: input.id,
        title: `⚽ Pachanga en ${input.location}`,
        start,
        end: new Date(start.getTime() + EVENT_DURATION_MS),
        location: input.location,
        description: `${DESCRIPTION_PREFIX}\n${url}`,
        url,
    };
}

export function createGoogleCalendarUrl(event: CalendarEventData): string {
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", event.title);
    url.searchParams.set("dates", `${toCompactUtc(event.start)}/${toCompactUtc(event.end)}`);
    url.searchParams.set("details", event.description);
    url.searchParams.set("location", event.location);
    return url.toString();
}

export function createOutlookCalendarUrl(event: CalendarEventData): string {
    const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
    url.searchParams.set("path", "/calendar/action/compose");
    url.searchParams.set("rru", "addevent");
    url.searchParams.set("subject", event.title);
    url.searchParams.set("startdt", event.start.toISOString());
    url.searchParams.set("enddt", event.end.toISOString());
    url.searchParams.set("body", event.description);
    url.searchParams.set("location", event.location);
    return url.toString();
}

function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

function foldIcsLine(line: string): string[] {
    const codePoints = Array.from(line);
    const folded: string[] = [];
    let offset = 0;
    let firstLine = true;

    do {
        const maxBytes = firstLine ? 75 : 74;
        let value = "";

        while (offset < codePoints.length) {
            const next = value + codePoints[offset];
            if (new TextEncoder().encode(next).length > maxBytes) {
                break;
            }
            value = next;
            offset += 1;
        }

        folded.push(`${firstLine ? "" : " "}${value}`);
        firstLine = false;
    } while (offset < codePoints.length);

    return folded;
}

export function createIcsContent(event: CalendarEventData, generatedAt = new Date()): string {
    const uid = `${event.id}@${new URL(event.url).hostname}`;
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Pachangas//Calendar Event//ES",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toCompactUtc(generatedAt)}`,
        `DTSTART:${toCompactUtc(event.start)}`,
        `DTEND:${toCompactUtc(event.end)}`,
        `SUMMARY:${escapeIcsText(event.title)}`,
        `DESCRIPTION:${escapeIcsText(event.description)}`,
        `LOCATION:${escapeIcsText(event.location)}`,
        `URL:${escapeIcsText(event.url)}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ];

    return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

export function createIcsFilename(event: CalendarEventData): string {
    return `pachanga-${event.start.toISOString().slice(0, 10)}.ics`;
}
