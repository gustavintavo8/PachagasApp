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

test("navega por los tres elementos con Arrow/Home/End y conserva Tab/Escape/click externo", async ({ page }) => {
    const matchPage = new MatchPage(page);
    const matchId = await matchPage.createMatch("Campo Navegación", 2880);

    try {
        const trigger = page.getByRole("button", { name: "Añadir al calendario" });
        const google = page.getByRole("menuitem", { name: "Google Calendar" });
        const outlook = page.getByRole("menuitem", { name: "Outlook" });
        const download = page.getByRole("menuitem", { name: "Descargar archivo .ics" });

        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(google).toBeFocused();

        await page.keyboard.press("ArrowDown");
        await expect(outlook).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(download).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(google).toBeFocused();

        await page.keyboard.press("ArrowUp");
        await expect(download).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await expect(outlook).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await expect(google).toBeFocused();
        await page.keyboard.press("Home");
        await expect(google).toBeFocused();
        await page.keyboard.press("End");
        await expect(download).toBeFocused();
        await page.keyboard.press("Home");
        await expect(google).toBeFocused();

        await page.keyboard.press("Tab");
        await expect(download).not.toBeFocused();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu", { name: "Opciones de calendario" })).toBeHidden();
        await expect(trigger).toBeFocused();

        await trigger.press("Enter");
        await expect(page.getByRole("menu", { name: "Opciones de calendario" })).toBeVisible();
        await page.locator("main").click({ position: { x: 5, y: 5 } });
        await expect(page.getByRole("menu", { name: "Opciones de calendario" })).toBeHidden();
    } finally {
        await deleteMatch(matchId);
    }
});

test("muestra un error y no abre un menú vacío si falla la preparación del evento", async ({ page }) => {
    await page.addInitScript(() => {
        const NativeURL = window.URL;
        const failingOrigin = window.location.origin;

        class FailingURL extends NativeURL {
            constructor(input: string | URL, base?: string | URL) {
                if (input === failingOrigin) {
                    throw new Error("fallo controlado al construir el evento");
                }
                super(input, base);
            }
        }

        window.URL = FailingURL as typeof URL;
    });

    const matchPage = new MatchPage(page);
    const matchId = await matchPage.createMatch("Campo Evento", 2880);

    try {
        const trigger = page.getByRole("button", { name: "Añadir al calendario" });
        await expect(trigger).toBeVisible();
        await trigger.click();

        await expect(page.getByText("No se pudo preparar el evento")).toBeVisible();
        await expect(page.getByRole("menu", { name: "Opciones de calendario" })).toBeHidden();
        await expect(page.getByRole("menuitem")).toHaveCount(0);
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
