import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Cargar .env.test.local ANTES de cualquier otra cosa.
// override: true garantiza que sobreescribe variables ya cargadas (incluidas las de .env.local).
// Esto hace imposible que los tests lean credenciales de producción.
dotenv.config({ path: path.resolve(__dirname, ".env.test.local"), override: true });

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",
    globalSetup: "./e2e/global-setup.ts",
    use: {
        baseURL: "http://localhost:3000",
        storageState: "e2e/.auth/user.json",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile-chrome",
            use: { ...devices["Pixel 5"] },
            grep: /@mobile|@smoke/,
        },
        {
            name: "mobile-safari",
            use: { ...devices["iPhone 13"] },
            grep: /@mobile|@smoke/,
        },
    ],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        // Las NEXT_PUBLIC_ vars ya están en process.env gracias al dotenv.config arriba.
        // El proceso hijo (Next.js dev) las hereda automáticamente.
    },
});
