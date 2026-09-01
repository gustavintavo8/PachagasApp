import assert from "node:assert/strict";
import test from "node:test";
import * as calendar from "../src/lib/calendar-event.ts";

const input = {
    id: "match-123",
    date: "2026-09-04T18:30:00.000Z",
    location: "Campo Ñandú, Madrid",
    origin: "https://example.com",
};

test("normaliza un partido como evento de una hora sin participantes", () => {
    const actual = typeof calendar.createMatchCalendarEvent === "function"
        ? calendar.createMatchCalendarEvent(input)
        : null;

    assert.equal(actual?.title, "⚽ Pachanga en Campo Ñandú, Madrid");
    assert.equal(actual?.start.toISOString(), "2026-09-04T18:30:00.000Z");
    assert.equal(actual?.end.toISOString(), "2026-09-04T19:30:00.000Z");
    assert.equal(actual?.location, "Campo Ñandú, Madrid");
    assert.equal(
        actual?.description,
        "Partido organizado en Pachangas\nhttps://example.com/matches/match-123"
    );
    assert.doesNotMatch(actual?.description ?? "", /jugador|participante/i);
});

test("rechaza una fecha de partido inválida", () => {
    assert.throws(
        () => calendar.createMatchCalendarEvent?.({ ...input, date: "sin-fecha" }),
        /fecha del partido no es válida/i
    );
});

test("solo permite exportar partidos futuros abiertos o cerrados", () => {
    const now = new Date("2026-09-04T17:30:00.000Z");
    assert.equal(calendar.canAddMatchToCalendar?.("open", input.date, now), true);
    assert.equal(calendar.canAddMatchToCalendar?.("closed", input.date, now), true);
    assert.equal(calendar.canAddMatchToCalendar?.("finished", input.date, now), false);
    assert.equal(calendar.canAddMatchToCalendar?.("cancelled", input.date, now), false);
    assert.equal(
        calendar.canAddMatchToCalendar?.("open", "2026-09-04T16:30:00.000Z", now),
        false
    );
    assert.equal(calendar.canAddMatchToCalendar?.("open", "sin-fecha", now), false);
});

test("genera el enlace de Google con intervalo UTC y campos codificados", () => {
    const event = calendar.createMatchCalendarEvent?.(input);
    const url = new URL(calendar.createGoogleCalendarUrl?.(event));
    assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
    assert.equal(url.searchParams.get("action"), "TEMPLATE");
    assert.equal(url.searchParams.get("text"), "⚽ Pachanga en Campo Ñandú, Madrid");
    assert.equal(url.searchParams.get("dates"), "20260904T183000Z/20260904T193000Z");
    assert.equal(url.searchParams.get("location"), "Campo Ñandú, Madrid");
    assert.equal(
        url.searchParams.get("details"),
        "Partido organizado en Pachangas\nhttps://example.com/matches/match-123"
    );
});

test("genera el enlace de Outlook con fechas ISO y campos codificados", () => {
    const event = calendar.createMatchCalendarEvent?.(input);
    const url = new URL(calendar.createOutlookCalendarUrl?.(event));
    assert.equal(
        url.origin + url.pathname,
        "https://outlook.live.com/calendar/0/deeplink/compose"
    );
    assert.equal(url.searchParams.get("rru"), "addevent");
    assert.equal(url.searchParams.get("subject"), "⚽ Pachanga en Campo Ñandú, Madrid");
    assert.equal(url.searchParams.get("startdt"), "2026-09-04T18:30:00.000Z");
    assert.equal(url.searchParams.get("enddt"), "2026-09-04T19:30:00.000Z");
    assert.equal(url.searchParams.get("location"), "Campo Ñandú, Madrid");
    assert.equal(
        url.searchParams.get("body"),
        "Partido organizado en Pachangas\nhttps://example.com/matches/match-123"
    );
});

test("genera iCalendar estable, escapado, plegado y terminado en CRLF", () => {
    const event = calendar.createMatchCalendarEvent?.({
        ...input,
        location: "Campo Ñandú, Madrid; pista \\\\ norte",
    });
    const ics = calendar.createIcsContent?.(
        event,
        new Date("2026-09-02T10:00:00.000Z")
    );

    assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-\/\/Pachangas\/\/Calendar Event\/\/ES\r\n/);
    assert.match(ics, /UID:match-123@example\.com\r\n/);
    assert.match(ics, /DTSTAMP:20260902T100000Z\r\n/);
    assert.match(ics, /DTSTART:20260904T183000Z\r\nDTEND:20260904T193000Z\r\n/);
    const unfolded = ics.replace(/\r\n[ \t]/g, "");
    assert.match(unfolded, /SUMMARY:⚽ Pachanga en Campo Ñandú\\, Madrid\\; pista/);
    assert.match(unfolded, /DESCRIPTION:Partido organizado en Pachangas\\nhttps:\/\/example\.com\/matches\/match-123/);
    assert.match(unfolded, /LOCATION:Campo Ñandú\\, Madrid\\; pista \\\\\\\\ norte/);
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    for (const line of ics.split("\r\n")) {
        assert.ok(new TextEncoder().encode(line).length <= 75, line);
    }
});

test("genera un nombre de archivo reconocible", () => {
    const event = calendar.createMatchCalendarEvent?.(input);
    assert.equal(calendar.createIcsFilename?.(event), "pachanga-2026-09-04.ics");
});
