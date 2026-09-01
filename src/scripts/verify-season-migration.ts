import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) throw new Error("Faltan credenciales Supabase");

const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

type Season = { id: string; slug: string; status: "active" | "archived"; starts_at: string; ends_at: string | null };
type Profile = { id: string; elo_rating: number | null; matches_played: number | null; goals_scored: number | null };
type SeasonStat = { season_id: string; user_id: string; elo_rating: number; matches_played: number; goals_scored: number; wins: number; draws: number; losses: number; mvps: number };
type Match = { id: string; status: string; season_id: string; team_a_score: number | null; team_b_score: number | null };
type Participant = { match_id: string; user_id: string; team: string; goals: number | null; is_mvp: boolean | null };
type Aggregate = { matches_played: number; goals_scored: number; wins: number; draws: number; losses: number; mvps: number };
type LegacyCounterComparison = {
    user_id: string;
    legacy: Pick<Profile, "matches_played" | "goals_scored">;
    raw: Pick<Aggregate, "matches_played" | "goals_scored">;
    season_one: Pick<SeasonStat, "matches_played" | "goals_scored">;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function read<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>, label: string): Promise<T> {
    const { data, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    assert(data !== null, `${label}: respuesta vacía`);
    return data;
}

function assertStats(actual: SeasonStat, expected: SeasonStat, label: string) {
    for (const field of ["elo_rating", "matches_played", "goals_scored", "wins", "draws", "losses", "mvps"] as const) {
        assert(actual[field] === expected[field], `${label}: ${field} esperado ${expected[field]}, recibido ${actual[field]}`);
    }
}

async function main() {
    const seasons = await read<Season[]>(
        admin.from("seasons").select("id, slug, status, starts_at, ends_at").order("starts_at", { ascending: true }),
        "No se pudo leer seasons"
    );
    assert(seasons.length === 2, `Deben existir exactamente dos temporadas, recibidas ${seasons.length}`);
    const season1 = seasons.find((season) => season.slug === "season-1");
    const season2 = seasons.find((season) => season.slug === "season-2");
    assert(season1?.status === "archived", "Falta Temporada 1 archivada");
    assert(season2?.status === "active", "Falta Temporada 2 activa");
    assert(seasons.filter((season) => season.status === "active").length === 1, "Debe existir exactamente una temporada activa");

    const [profiles, seasonStats, matches, participants, nullMatches, nullRp, nonSeasonOneMatches, nonSeasonOneRp, catalog, privateCatalog, publicRpcCatalog] = await Promise.all([
        read<Profile[]>(admin.from("profiles").select("id, elo_rating, matches_played, goals_scored"), "No se pudo leer profiles"),
        read<SeasonStat[]>(admin.from("season_player_stats").select("season_id, user_id, elo_rating, matches_played, goals_scored, wins, draws, losses, mvps"), "No se pudo leer season_player_stats"),
        read<Match[]>(admin.from("matches").select("id, status, season_id, team_a_score, team_b_score"), "No se pudo leer matches"),
        read<Participant[]>(admin.from("match_participants").select("match_id, user_id, team, goals, is_mvp"), "No se pudo leer match_participants"),
        read<number>(admin.from("matches").select("id", { count: "exact", head: true }).is("season_id", null).then(({ count, error }) => ({ data: count ?? 0, error })), "No se pudo comprobar matches.season_id"),
        read<number>(admin.from("rp_history").select("id", { count: "exact", head: true }).is("season_id", null).then(({ count, error }) => ({ data: count ?? 0, error })), "No se pudo comprobar rp_history.season_id"),
        read<number>(admin.from("matches").select("id", { count: "exact", head: true }).neq("season_id", season1.id).then(({ count, error }) => ({ data: count ?? 0, error })), "No se pudo comprobar matches de Season 1"),
        read<number>(admin.from("rp_history").select("id", { count: "exact", head: true }).neq("season_id", season1.id).then(({ count, error }) => ({ data: count ?? 0, error })), "No se pudo comprobar rp_history de Season 1"),
        read<Record<string, boolean>>(admin.rpc("verify_season_migration_contract"), "No se pudo comprobar el catálogo SQL"),
        read<Record<string, boolean>>(admin.rpc("verify_private_access_rls_contract"), "No se pudo comprobar el contrato RLS de acceso privado"),
        read<Record<string, boolean>>(admin.rpc("verify_public_rpc_security_contract"), "No se pudo comprobar el contrato de RPC públicos"),
    ]);

    assert(nullMatches === 0, `Quedan ${nullMatches} partidos sin temporada`);
    assert(nullRp === 0, `Quedan ${nullRp} eventos RP sin temporada`);
    assert(nonSeasonOneMatches === 0, `Hay ${nonSeasonOneMatches} partidos que no apuntan a Season 1`);
    assert(nonSeasonOneRp === 0, `Hay ${nonSeasonOneRp} eventos RP que no apuntan a Season 1`);
    assert(catalog.ok === true, `Fallos de catálogo/privilegios: ${JSON.stringify(catalog)}`);
    assert(privateCatalog.ok === true, `Fallos del contrato RLS: ${JSON.stringify(privateCatalog)}`);
    assert(publicRpcCatalog.ok === true, `Fallos de RPC/privilegios: ${JSON.stringify(publicRpcCatalog)}`);

    const statsByKey = new Map(seasonStats.map((stat) => [`${stat.season_id}:${stat.user_id}`, stat]));
    assert(seasonStats.length === profiles.length * 2, `Se esperaban ${profiles.length * 2} filas de stats, recibidas ${seasonStats.length}`);
    const aggregates = new Map<string, Aggregate>();
    const finishedMatches = new Map(matches.filter((match) => match.status === "finished" && match.season_id === season1.id).map((match) => [match.id, match]));
    for (const participant of participants) {
        const match = finishedMatches.get(participant.match_id);
        if (!match || !["A", "B"].includes(participant.team)) continue;
        const aggregate = aggregates.get(participant.user_id) ?? { matches_played: 0, goals_scored: 0, wins: 0, draws: 0, losses: 0, mvps: 0 };
        aggregate.matches_played += 1;
        aggregate.goals_scored += participant.goals ?? 0;
        if (match.team_a_score === match.team_b_score) aggregate.draws += 1;
        else if ((participant.team === "A" && (match.team_a_score ?? 0) > (match.team_b_score ?? 0)) || (participant.team === "B" && (match.team_b_score ?? 0) > (match.team_a_score ?? 0))) aggregate.wins += 1;
        else aggregate.losses += 1;
        if (participant.is_mvp) aggregate.mvps += 1;
        aggregates.set(participant.user_id, aggregate);
    }

    const legacyCounterComparisons: LegacyCounterComparison[] = [];
    const legacyCounterDiscrepancies: LegacyCounterComparison[] = [];
    for (const profile of profiles) {
        const raw = aggregates.get(profile.id) ?? { matches_played: 0, goals_scored: 0, wins: 0, draws: 0, losses: 0, mvps: 0 };
        const seasonOne = statsByKey.get(`${season1.id}:${profile.id}`);
        const seasonTwo = statsByKey.get(`${season2.id}:${profile.id}`);
        assert(seasonOne && seasonTwo, `Faltan filas de stats para ${profile.id}`);

        const comparison: LegacyCounterComparison = {
            user_id: profile.id,
            legacy: {
                matches_played: profile.matches_played,
                goals_scored: profile.goals_scored,
            },
            raw: {
                matches_played: raw.matches_played,
                goals_scored: raw.goals_scored,
            },
            season_one: {
                matches_played: seasonOne.matches_played,
                goals_scored: seasonOne.goals_scored,
            },
        };
        legacyCounterComparisons.push(comparison);
        if (
            (profile.matches_played !== null && profile.matches_played !== raw.matches_played) ||
            (profile.goals_scored !== null && profile.goals_scored !== raw.goals_scored)
        ) {
            legacyCounterDiscrepancies.push(comparison);
        }

        // Existing non-null legacy counters are preserved as the Season 1 compatibility
        // snapshot. Raw finished-match aggregates are the fallback for null legacy values;
        // any disagreement is reported explicitly below instead of being hidden by ??.
        assertStats(seasonOne, { season_id: season1.id, user_id: profile.id, elo_rating: profile.elo_rating ?? 1000, matches_played: profile.matches_played ?? raw.matches_played, goals_scored: profile.goals_scored ?? raw.goals_scored, wins: raw.wins, draws: raw.draws, losses: raw.losses, mvps: raw.mvps }, `Season 1 ${profile.id}`);
        assertStats(seasonTwo, { season_id: season2.id, user_id: profile.id, elo_rating: 1000, matches_played: 0, goals_scored: 0, wins: 0, draws: 0, losses: 0, mvps: 0 }, `Season 2 ${profile.id}`);
    }

    const coherentWithRawMatchAggregate = legacyCounterDiscrepancies.length === 0;
    if (!coherentWithRawMatchAggregate) {
        console.warn(`Se detectaron ${legacyCounterDiscrepancies.length} discrepancias entre perfiles heredados y partidos finalizados`);
    }

    console.log(JSON.stringify({
        seasons,
        profiles: profiles.length,
        seasonStats: seasonStats.length,
        nullMatches,
        nullRp,
        catalog,
        privateCatalog,
        publicRpcCatalog,
        coherentWithRawMatchAggregate,
        legacyCounterComparisons,
        legacyCounterDiscrepancies,
    }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
