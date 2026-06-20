import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// No requiere sesión: probamos el rol anónimo directamente contra PostgREST.
test.describe("Bloque 0 — el email no es público", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("el rol anónimo no puede seleccionar profiles.email", async () => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error } = await supabase.from("profiles").select("email").limit(1);
        // Tras eliminar la columna, PostgREST responde con error de columna inexistente.
        expect(error).not.toBeNull();
        expect(error?.message ?? "").toMatch(/email/i);
    });

    test("el rol anónimo sigue viendo los campos públicos", async () => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error } = await supabase
            .from("profiles")
            .select("username, avatar_url, elo_rating")
            .limit(1);
        expect(error).toBeNull();
    });
});
