# Add Match to Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible **Añadir al calendario** menu to upcoming match details, with Google Calendar, Outlook, and standards-compliant `.ics` export for a one-hour event.

**Architecture:** A pure `src/lib/calendar-event.ts` module owns event normalization, provider URLs, visibility, iCalendar serialization, and filenames. A focused client component owns menu interaction and browser download behavior, while `MatchDetail.tsx` only supplies match data and places the component beside the existing share controls.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, `lucide-react`, Node test runner with `tsx`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-02-add-match-to-calendar-design.md`

## Global Constraints

- The visible copy is exactly **Añadir al calendario** and the trigger icon is `CalendarPlus` from `lucide-react`.
- The event title is exactly `⚽ Pachanga en {ubicación}`.
- The event lasts exactly 60 minutes.
- The event location is `match.location`.
- The description is `Partido organizado en Pachangas`, a newline, and the public match URL.
- Player counts and participant data must not appear in any calendar output.
- Only future matches with status `open` or `closed` expose the control.
- Google Calendar and Outlook open as normal external links; `.ics` downloads without leaving the page.
- No Supabase schema, migration, endpoint, OAuth integration, runtime dependency, or configurable duration is added.
- The menu matches the existing compact share-row styling and remains usable with mouse, keyboard, and mobile viewport widths.
- Every subagent used during execution or review must explicitly use model `gpt-5.6-luna` with reasoning effort `high`.

---

## File Map

- Create `src/lib/calendar-event.ts`: pure event model, validation, visibility, provider URL generation, RFC 5545 text escaping/folding, `.ics` content, and filename.
- Create `test/calendar-event.test.mjs`: behavior tests with hand-derived expected values for every pure calendar contract.
- Modify `package.json`: add a `test:unit` script and `tsx` as a development-only test loader.
- Modify `package-lock.json`: lock the new development-only `tsx` dependency.
- Create `src/components/AddToCalendar.tsx`: accessible popover/menu, client-origin resolution, external links, and `.ics` Blob download.
- Create `e2e/calendar-export.spec.ts`: real-browser acceptance coverage for menu behavior, provider payloads, download content, and mobile overflow.
- Modify `src/app/matches/[id]/MatchDetail.tsx:1-70,290-312`: import and render the new component in the existing share row.

---

### Task 1: Pure calendar event contracts

**Files:**
- Create: `src/lib/calendar-event.ts`
- Create: `test/calendar-event.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: match `id`, ISO date string, location, current `origin`, and match status.
- Produces:

```ts
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

export function canAddMatchToCalendar(
    status: CalendarMatchStatus,
    date: string,
    now?: Date
): boolean;
export function createMatchCalendarEvent(input: MatchCalendarInput): CalendarEventData;
export function createGoogleCalendarUrl(event: CalendarEventData): string;
export function createOutlookCalendarUrl(event: CalendarEventData): string;
export function createIcsContent(event: CalendarEventData, generatedAt?: Date): string;
export function createIcsFilename(event: CalendarEventData): string;
```

- [ ] **Step 1: Install the development-only TypeScript test loader and add the unit script**

Run:

```powershell
npm install --save-dev tsx
```

Add this script to `package.json`:

```json
"test:unit": "node --import tsx --test test/*.test.mjs"
```

Expected: only `package.json` and `package-lock.json` change; `tsx` is under `devDependencies`.

- [ ] **Step 2: Write failing behavior tests before calendar production logic exists**

Create `test/calendar-event.test.mjs`. Import the module as a namespace so an empty scaffold yields assertion failures rather than an invalid named-export error:

```js
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
```

Continue the same file with literal assertions that prove:

```js
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
```

- [ ] **Step 3: Run the new test and observe the expected module error**

Run:

```powershell
node --import tsx --test test/calendar-event.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `src/lib/calendar-event.ts` has not been created.

- [ ] **Step 4: Add an empty module scaffold and verify a real assertion failure**

Create `src/lib/calendar-event.ts` containing only:

```ts
export {};
```

Run only the first behavior while establishing RED:

```powershell
node --import tsx --test --test-name-pattern="normaliza un partido" test/calendar-event.test.mjs
```

Expected: FAIL on the behavioral assertion because the calendar function is unavailable. This is the RED state; do not add calendar behavior before observing it.

- [ ] **Step 5: Implement the minimal pure calendar module**

Implement the interfaces above and these exact rules:

```ts
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
```

`createMatchCalendarEvent` must normalize the origin with `new URL(origin).origin`, construct `/matches/{encodeURIComponent(id)}`, use the exact title/description from Global Constraints, and return `end = start + EVENT_DURATION_MS`.

Google must use `new URL("https://calendar.google.com/calendar/render")` and `URLSearchParams` fields `action`, `text`, `dates`, `details`, and `location`. Outlook must use `new URL("https://outlook.live.com/calendar/0/deeplink/compose")` and fields `path=/calendar/action/compose`, `rru=addevent`, `subject`, `startdt`, `enddt`, `body`, and `location`.

For iCalendar, escape text in this order:

```ts
function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}
```

Fold each logical line by Unicode code point so the first physical line is at most 75 UTF-8 octets and continuation lines begin with one space and contain at most 74 additional octets. Join folded lines with `\r\n`. Build the stable UID as `{event.id}@{new URL(event.url).hostname}` and include the fields listed in the spec in this order:

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Pachangas//Calendar Event//ES
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:...
DTSTAMP:...
DTSTART:...
DTEND:...
SUMMARY:...
DESCRIPTION:...
LOCATION:...
URL:...
END:VEVENT
END:VCALENDAR
```

End the file with CRLF. `createIcsFilename` uses the UTC start date (`YYYY-MM-DD`) and returns `pachanga-{date}.ics`.

- [ ] **Step 6: Run the focused tests, then the complete unit suite**

Run:

```powershell
node --import tsx --test test/calendar-event.test.mjs
npm run test:unit
```

Expected: all calendar tests and all existing `test/*.test.mjs` tests pass with zero failures.

- [ ] **Step 7: Type-check and commit Task 1**

Run:

```powershell
npx tsc --noEmit
git add package.json package-lock.json src/lib/calendar-event.ts test/calendar-event.test.mjs
git commit -m "feat: add calendar event generators"
```

Expected: type-check exits 0 and the commit contains only the four Task 1 files.

---

### Task 2: Accessible calendar menu and match-detail integration

**Files:**
- Create: `src/components/AddToCalendar.tsx`
- Create: `e2e/calendar-export.spec.ts`
- Modify: `src/app/matches/[id]/MatchDetail.tsx:1-70,290-312`

**Interfaces:**
- Consumes from Task 1: `canAddMatchToCalendar`, `createMatchCalendarEvent`, `createGoogleCalendarUrl`, `createOutlookCalendarUrl`, `createIcsContent`, and `createIcsFilename`.
- Produces:

```ts
interface AddToCalendarProps {
    match: Pick<Match, "id" | "date" | "location" | "status">;
}

export function AddToCalendar({ match }: AddToCalendarProps): React.JSX.Element | null;
```

- [ ] **Step 1: Write the failing real-browser acceptance tests**

Create `e2e/calendar-export.spec.ts`. Use `MatchPage.createMatch` and `deleteMatch` so every test owns and removes its match. The primary test must:

```ts
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deleteMatch } from "./helpers/db";
import { MatchPage } from "./pages/MatchPage";

test("exporta un partido de una hora a Google, Outlook e iCalendar @smoke", async ({ page }) => {
    const matchPage = new MatchPage(page);
    const matchId = await matchPage.createMatch("Campo Ñandú, Madrid", 2880);

    try {
        const trigger = page.getByRole("button", { name: "Añadir al calendario" });
        await expect(trigger).toBeVisible();
        await trigger.click();

        const menu = page.getByRole("menu", { name: "Opciones de calendario" });
        await expect(menu).toBeVisible();

        const googleHref = await page
            .getByRole("menuitem", { name: "Google Calendar" })
            .getAttribute("href");
        const google = new URL(googleHref!);
        expect(google.origin + google.pathname).toBe(
            "https://calendar.google.com/calendar/render"
        );
        expect(google.searchParams.get("text")).toBe("⚽ Pachanga en Campo Ñandú, Madrid");
        expect(google.searchParams.get("location")).toBe("Campo Ñandú, Madrid");
        expect(google.searchParams.get("details")).toContain(`/matches/${matchId}`);
        expect(google.searchParams.get("details")).not.toMatch(/jugador|participante/i);
        const [googleStart, googleEnd] = google.searchParams.get("dates")!.split("/");
        const parseCompact = (value: string) => Date.parse(
            value.replace(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
                "$1-$2-$3T$4:$5:$6Z"
            )
        );
        expect(parseCompact(googleEnd) - parseCompact(googleStart)).toBe(3_600_000);

        const outlookHref = await page
            .getByRole("menuitem", { name: "Outlook" })
            .getAttribute("href");
        const outlook = new URL(outlookHref!);
        expect(outlook.searchParams.get("subject")).toBe("⚽ Pachanga en Campo Ñandú, Madrid");
        expect(
            Date.parse(outlook.searchParams.get("enddt")!) -
            Date.parse(outlook.searchParams.get("startdt")!)
        ).toBe(3_600_000);

        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("menuitem", { name: "Descargar archivo .ics" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/^pachanga-\d{4}-\d{2}-\d{2}\.ics$/);
        const downloadedPath = await download.path();
        const ics = await readFile(downloadedPath!, "utf8");
        expect(ics).toContain("SUMMARY:⚽ Pachanga en Campo Ñandú\\, Madrid");
        expect(ics).toContain("DTSTART:");
        expect(ics).toContain("DTEND:");
        expect(ics).toContain(`/matches/${matchId}`);
        expect(ics).not.toMatch(/jugador|participante/i);
    } finally {
        await deleteMatch(matchId);
    }
});
```

Add these keyboard and mobile behaviors to the same file:

```ts
test("abre y cierra el menú con teclado devolviendo el foco", async ({ page }) => {
    const matchPage = new MatchPage(page);
    const matchId = await matchPage.createMatch("Campo Teclado", 2880);

    try {
        const trigger = page.getByRole("button", { name: "Añadir al calendario" });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("menu", { name: "Opciones de calendario" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Google Calendar" })).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu", { name: "Opciones de calendario" })).toBeHidden();
        await expect(trigger).toBeFocused();
    } finally {
        await deleteMatch(matchId);
    }
});

test("el control no provoca desbordamiento horizontal @mobile", async ({ page }) => {
    const matchPage = new MatchPage(page);
    const matchId = await matchPage.createMatch("Campo móvil", 2880);

    try {
        await expect(page.getByRole("button", { name: "Añadir al calendario" })).toBeVisible();
        const dimensions = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
        }));
        expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    } finally {
        await deleteMatch(matchId);
    }
});
```

- [ ] **Step 2: Run the focused browser test and verify RED**

Run:

```powershell
npx playwright test e2e/calendar-export.spec.ts --project=chromium
```

Expected: FAIL because the **Añadir al calendario** button does not exist. Confirm local Supabase remains the configured test target before addressing any setup failure.

- [ ] **Step 3: Implement the focused client component**

Create `src/components/AddToCalendar.tsx` as a client component. Use `useEffect`, `useMemo`, `useRef`, and `useState`; `CalendarPlus`, `ExternalLink`, and `Download` from `lucide-react`; `useToast`; `Match`; and the Task 1 utility functions.

Required state and lifecycle:

```ts
const [origin, setOrigin] = useState<string | null>(null);
const [open, setOpen] = useState(false);
const rootRef = useRef<HTMLDivElement>(null);
const triggerRef = useRef<HTMLButtonElement>(null);
const firstItemRef = useRef<HTMLAnchorElement>(null);

useEffect(() => setOrigin(window.location.origin), []);
```

Derive availability only after `origin` exists. Return `null` unless `canAddMatchToCalendar(match.status, match.date)` is true. Catch event-construction failures and call `toast("No se pudo preparar el evento", "error")` from an interaction rather than throwing during render.

When open, install document listeners that:

- close on `pointerdown` outside `rootRef`;
- close on `Escape` and return focus to `triggerRef`;
- clean up both listeners on close/unmount.

After opening, focus `firstItemRef`. Render this trigger contract:

```tsx
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
```

Render an absolutely positioned menu inside a `relative` root with `id="calendar-options-menu"`, `role="menu"`, and `aria-label="Opciones de calendario"`. Google and Outlook are anchors with `role="menuitem"`, `target="_blank"`, and `rel="noopener noreferrer"`. The `.ics` action is a `type="button"` with `role="menuitem"`. All three use compact `rounded-lg` rows with visible focus and the existing `surface`, `border`, `muted`, and `accent` tokens.

For download, generate the content at click time and use:

```ts
const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
const objectUrl = URL.createObjectURL(blob);
const anchor = document.createElement("a");
anchor.href = objectUrl;
anchor.download = createIcsFilename(event);
document.body.appendChild(anchor);
anchor.click();
anchor.remove();
window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
```

Close the menu after download. If generation fails, show the exact error toast above and close the menu.

- [ ] **Step 4: Integrate the component into the existing share row**

In `src/app/matches/[id]/MatchDetail.tsx`, import:

```ts
import { AddToCalendar } from "@/components/AddToCalendar";
```

Inside the existing `flex flex-wrap items-center gap-2` share container, render it after WhatsApp:

```tsx
<AddToCalendar match={match} />
```

Do not alter the existing copy-link or WhatsApp behavior and do not pass participants.

- [ ] **Step 5: Run focused tests and address only behavior required by the spec**

Run:

```powershell
npm run test:unit
npx playwright test e2e/calendar-export.spec.ts --project=chromium
npx playwright test e2e/calendar-export.spec.ts --project=mobile-chrome
npx playwright test e2e/calendar-export.spec.ts --project=mobile-safari
```

Expected: all unit tests and calendar-export tests pass. The mobile tests show no horizontal overflow.

- [ ] **Step 6: Run project verification**

Run:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e -- --project=chromium
```

Expected: each command exits 0. If the repository has pre-existing lint warnings, record the exact warning count and verify this task introduced no new warning or error.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add src/components/AddToCalendar.tsx src/app/matches/[id]/MatchDetail.tsx e2e/calendar-export.spec.ts
git commit -m "feat: add match calendar export menu"
```

Expected: commit contains only the Task 2 files and the worktree retains the unrelated untracked reports untouched.

---

## Final acceptance checklist

- [ ] Re-read the design spec and confirm every acceptance criterion maps to a passing unit or browser check.
- [ ] Inspect the final branch diff for accidental Supabase, participant, Fantasy, or unrelated changes.
- [ ] Run `git diff --check` and confirm zero whitespace errors.
- [ ] Run `npm run test:unit`, focused calendar Playwright tests, `npm run lint`, `npx tsc --noEmit`, and `npm run build` on the final HEAD.
- [ ] Perform the required whole-branch review with a fresh `gpt-5.6-luna` / `high` reviewer before declaring completion.
