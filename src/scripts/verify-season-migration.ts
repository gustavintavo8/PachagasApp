import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
    throw new Error("Faltan credenciales Supabase");
}

const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    const { data: seasons, error } = await admin
        .from("seasons")
        .select("id, slug, status, starts_at, ends_at")
        .order("starts_at", { ascending: true });

    if (error) throw new Error("No se pudo leer seasons: " + error.message);

    const season1 = seasons?.find((s) => s.slug === "season-1");
    const season2 = seasons?.find((s) => s.slug === "season-2");

    if (!season1 || season1.status !== "archived") {
        throw new Error("Falta Temporada 1 archivada");
    }

    if (!season2 || season2.status !== "active") {
        throw new Error("Falta Temporada 2 activa");
    }

    if ((seasons?.filter((s) => s.status === "active").length ?? 0) !== 1) {
        throw new Error("Debe existir exactamente una temporada activa");
    }

    const [{ count: nullMatches }, { count: nullRp }, { count: season2Stats }] = await Promise.all([
        admin.from("matches").select("id", { count: "exact", head: true }).is("season_id", null),
        admin.from("rp_history").select("id", { count: "exact", head: true }).is("season_id", null),
        admin
            .from("season_player_stats")
            .select("user_id", { count: "exact", head: true })
            .eq("season_id", season2.id),
    ]);

    if ((nullMatches ?? 0) !== 0) throw new Error("Quedan partidos sin temporada");
    if ((nullRp ?? 0) !== 0) throw new Error("Quedan eventos RP sin temporada");
    if ((season2Stats ?? 0) === 0) throw new Error("Temporada 2 no tiene filas iniciales");

    console.log(
        JSON.stringify(
            {
                seasons,
                season2Stats,
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
